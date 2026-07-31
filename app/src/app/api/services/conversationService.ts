import { CONVERSATION_STATUS } from "@/configs/constants";
import { getDeviceTypeFromId } from "@/utils/helperFunctions";
import { prisma } from "../utils/prisma";
import { NextRequest } from "next/server";
import { initializeI18n } from "../helpers/userHelper";
import { ConversationModel } from "../models/conversation";
import { CustomerModel } from "../models/customer";
import {
  deleteFile,
  generateUserAudioUploadPath,
  saveFileToFtp,
} from "../utils/fileStorage";

export const ConversationService = {
  async getConversations(
    req: NextRequest,
    userId: string | null,
    superAdminConversations: boolean,
    teamConversations?: boolean
  ) {
    try {
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { role: true },
        });

        if (!user) {
          throw new Error("User not found.");
        }
      }

      return await ConversationModel.getUserConversations(
        req,
        teamConversations,
        userId,
        superAdminConversations
      );
    } catch (error: any) {
      throw new Error(error?.message || "Error getting user profile.");
    }
  },

  async getUserId(data: any, user_id: string) {
    let customerId = data.customer_id || null;
    if (!customerId && data.customer_name) {
      let customer = await CustomerModel.findCustomerByName(
        user_id,
        data.customer_name
      );
      if (!customer) {
        customer = await CustomerModel.createCustomer(
          user_id,
          data.customer_name
        );
      }
      customerId = customer.id;
    }
    return customerId;
  },

  async getConversationById(conversationId: string, userId: string) {
    try {
      return ConversationModel.getConversationById(conversationId, userId);
    } catch (error: any) {
      throw new Error(error?.message || "Error fetching conversation.");
    }
  },

  async deleteConversation(conversationId: string) {
    try {
      return ConversationModel.deleteConversation(conversationId);
    } catch (error: any) {
      throw new Error(error?.message || "Error deleting conversation.");
    }
  },

  async updateConversation(
    data: any,
    conversationId: string,
    user_id: string,
    fileBuffer?: ArrayBuffer | null,
    fileName?: string,
    langCode?: string,
    withTwinAiFailure?: boolean
  ) {
    const conversation = await ConversationModel.getConversationById(
      conversationId,
      user_id
    );
    if (!conversation) {
      throw new Error("Conversation not found.");
    }
    let customerId = await this.getUserId(data, user_id);

    // Handle file upload
    let filePath = "";
    let fileDuration: number | null = 0;
    if (fileBuffer && fileName && !conversation.file_path) {
      const path = generateUserAudioUploadPath(user_id);
      try {
        filePath = await saveFileToFtp(fileBuffer, fileName, path); // Save file buffer
      } catch (error) {
        console.error("Error uploading file to FTP:", error);
        await ConversationModel.updateConversationStatus(
          conversationId,
          CONVERSATION_STATUS.FILE_UPLOAD_FAILED
        );
        throw new Error("File upload failed.");
      }
      // filePath = await saveFile(fileBuffer, fileName); // Save file buffer
      let rawDuration = data.file_duration || null;
      fileDuration =
        typeof rawDuration === "string"
          ? parseFloat(rawDuration) || 0.0
          : rawDuration || 0.0;
    }

    if (withTwinAiFailure) {
      await ConversationModel.updateConversationStatus(
        conversationId,
        CONVERSATION_STATUS.TWIN_AI_UPLOAD_FAILED
      );
    }
    // update conversation
    return ConversationModel.updateConversation(conversationId, {
      customer_id: customerId,
      title: data.title,
      notes: data.notes || null,
      ...(filePath
        ? {
            meeting_date: data?.meeting_date
              ? new Date(data.meeting_date)
              : null,
            meeting_time_start: data.meeting_time_start,
            meeting_time_end: data.meeting_time_end,
            file_path: filePath,
            file_duration: fileDuration,
          }
        : {}), // Update file path only if a new file is uploaded
    });
  },

  async getConversationSummaryXById(conversationId: string) {
    return await ConversationModel.getConversationSummaryXById(conversationId);
  },

  async updateConversationX(data: any, conversationId: string, userId: string) {
    const conversation = await ConversationModel.getConversationById(
      conversationId,
      userId
    );

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    // Handle customer_name: find customer and link via customer_id
    if (data.customer_name) {
      const customerName = data.customer_name.trim();
      const existingCustomer = await CustomerModel.findCustomerByName(
        userId,
        customerName
      );

      if (existingCustomer) {
        data.customer_id = existingCustomer.id;
      }

      if (!existingCustomer) {
        const newCustomer = await CustomerModel.createCustomer(
          userId,
          data.customer_name
        );
        data.customer_id = newCustomer.id;
      }
      delete data.customer_name;
    }

    return ConversationModel.updateConversation(conversationId, { ...data });
  },

  async deleteConversationDraft(conversationId: string, langCode?: string) {
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }
    try {
      const conversation = await ConversationModel.getConversationById(
        conversationId,
        "",
        false
      );
      if (!conversation) {
        throw new Error(i18n.t("errorMessages.conversationNotFound"));
      }
      if (conversation?.file_path) {
        try {
          let ftpPath = conversation.file_path;
          if (ftpPath.startsWith("http")) {
            const ftpRoot = process.env.NEXT_PUBLIC_FTP_PUBLIC_URL || "";
            if (ftpPath.startsWith(ftpRoot)) {
              ftpPath = ftpPath.replace(ftpRoot, "");
              if (ftpPath.startsWith("/")) ftpPath = ftpPath.slice(1);
            }
          }
          await deleteFile(ftpPath);
        } catch (error) {
          console.warn("Failed to delete conversation file:", error?.message);
        }
      }
      return ConversationModel.deleteConversationDraft(conversationId);
    } catch (error: any) {
      throw new Error(error?.message || "Error deleting conversation.");
    }
  },

  async getAudioFileStream(filePath: string) {
    try {
      if (!filePath) {
        throw new Error("File path is required.");
      }
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error("Error fetching audio file.");
      }
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("Content-Type") || "video/mp4";
      return { arrayBuffer, contentType };
    } catch (error: any) {
      throw new Error(error?.message || "Error fetching audio file.");
    }
  },

  async retryFileFTPUpload(
    conversationId: string,
    fileName: string,
    fileBuffer: ArrayBuffer,
    langCode?: string
  ) {
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }
    try {
      const conversation = await ConversationModel.getConversationById(
        conversationId,
        "",
        false
      );
      if (!conversation) {
        throw new Error(i18n.t("errorMessages.conversationNotFound"));
      }
      let filePath;
      if (fileBuffer) {
        const uploadFolder = generateUserAudioUploadPath(conversation.user_id);
        filePath = await saveFileToFtp(fileBuffer, fileName, uploadFolder);
      }
      await ConversationModel.updateConversationStatus(
        conversation.id,
        CONVERSATION_STATUS.FILE_UPLOAD_SUCCESS
      );
      return await ConversationModel.updateConversation(conversation.id, {
        file_path: filePath,
      });
    } catch (error: any) {
      throw new Error(error?.message || "Error retrying file upload.");
    }
  },

  async savePausedConversation(
    userId: string,
    deviceId?: string,
    title?: string
  ) {
    try {
      const conversation = await prisma.userConversation.create({
        data: {
          user_id: userId || "",
          conversation_status: CONVERSATION_STATUS.CONVERSATION_PAUSED,
          from_device_id: deviceId || null,
          title: title || "",
          transcription_provider: "assemblyai",
        },
      });
      return conversation;
    } catch (err: any) {
      throw new Error(err?.message || "Error saving paused conversation");
    }
  },

  async getConversationStatuses(userId: string, deviceId?: string) {
    try {
      const statuses = await prisma.userConversation.findMany({
        where: { user_id: userId || "" },
        select: {
          id: true,
          conversation_status: true,
          twinai_run_status: true,
          from_device_id: true,
        },
      });
      let allDevices = "";
      const result = {
        fileUploadFailedCount: 0,
        fileUploadFailedId: null as string | null,
        conversationPausedCount: 0,
        sameDevice: false,
        deviceId: undefined as string | undefined,
        allDevices: "",
      };
      let deviceIdToSend;
      for (const conv of statuses) {
        if (
          conv.conversation_status ===
            CONVERSATION_STATUS.CONVERSATION_PAUSED &&
          (!deviceId || conv.from_device_id !== deviceId)
        ) {
          result.conversationPausedCount++;
        }

        if (
          conv.conversation_status === CONVERSATION_STATUS.FILE_UPLOAD_FAILED
        ) {
          result.fileUploadFailedCount++;
          if (result.fileUploadFailedCount === 1) {
            result.fileUploadFailedId = conv.id; // capture ID of the single one
          } else {
            result.fileUploadFailedId = null; // more than one, reset to null
          }
        }
        if (conv.from_device_id === deviceId) {
          result.sameDevice = true;
        } else {
          // set all device types
          let device = getDeviceTypeFromId(conv.from_device_id || undefined);
          if (device && !allDevices.includes(device)) {
            allDevices += (allDevices ? ", " : "") + device;
          }
        }
      }
      if (allDevices) {
        result.sameDevice = false;
        result.deviceId = deviceIdToSend;
        result.allDevices = allDevices;
      }

      return result;
    } catch (err: any) {
      throw new Error(err?.message || "Error fetching conversation statuses");
    }
  },
};
