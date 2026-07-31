import { STATUS, USER_ROLE } from "@/configs/constants";
import bcrypt from "bcryptjs";
import fs from "fs";
import omit from "lodash/omit";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  initializeI18n,
  isContactManager,
  isSuperAdminUser,
} from "../helpers/userHelper";
import { UserModel } from "../models/user";
import {
  deleteFile,
  generateUserUploadPath,
  saveFileToFtp,
} from "../utils/fileStorage";
import { prisma } from "../utils/prisma";
import { getFullUrl } from "../utils/urlHelper";
import { mailService } from "./mailService";
import { syncUserToLMSAsync, deleteUserFromLMSAsync } from "@/lib/services/lms-sync";

export const UserService = {
  async getUserProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true, team: true, user_settings: true, company: true },
      });

      if (!user) {
        throw new Error("User not found.");
      }

      // Append full avatar URL if avatar exists
      if (user.avatar) {
        user.avatar = getFullUrl(user.avatar); // Use API route
      }

      return omit(user, ["password"]);
    } catch (error: any) {
      throw new Error(error?.message || "Error getting user profile.");
    }
  },

  async updateUserProfile(
    userId: string,
    userData: {
      name: string;
      email: string;
      phone_number: string;
      organization: string | null;
    },
    fileBuffer: ArrayBuffer | null,
    fileName: string
  ) {
    try {
      // Fetch the current user to get the old avatar path
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatar: true },
      });

      let filePath = "";

      // If a file is uploaded, save it and set the filePath
      if (fileBuffer) {
        const path = generateUserUploadPath();
        filePath = await saveFileToFtp(fileBuffer, fileName, path); // Save file buffer

        // Delete the old avatar if it exists
        if (user?.avatar) {
          await deleteFile(user.avatar);
        }
      }

      // Construct the data object dynamically
      const updateData: any = {
        name: userData.name,
        phone_number: userData.phone_number,
        email: userData.email,
      };

      // Only add avatar to updateData if filePath exists
      if (filePath) {
        updateData.avatar = filePath;
      }

      // Update user with only the required fields
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      if (updatedUser.avatar) {
        updatedUser.avatar = getFullUrl(updatedUser.avatar);
      }

      return updatedUser;
    } catch (error: any) {
      throw new Error(error?.message || "Error updating user profile.");
    }
  },

  async createUser(
    userData: {
      name: string;
      email: string;
      phone_number?: string;
      role?: string;
      company_id?: string;
    },
    invitingUser: {
      id: string;
      role: any;
      company_id: string;
      name: string;
      lang_code?: string;
    },
    isAdminInvite: boolean = false
  ) {
    const i18n = await initializeI18n();
    const t = i18n.t;
    try {
      const {
        name,
        email,
        phone_number,
        role,
        company_id: inputCompanyId,
      } = userData;

      // Privilege-escalation guard: only a real superadmin may create an
      // admin/superadmin account or assign an arbitrary role. A contact-manager
      // (who passes the invite gate) may only invite ordinary users/managers
      // into their own company — never a superadmin. Without this, a request
      // body of admin_invite=true or role="superadmin" would mint a
      // platform-wide superadmin from a normal customer account.
      const inviterIsSuperAdmin = isSuperAdminUser(invitingUser);
      if (isAdminInvite && !inviterIsSuperAdmin) {
        throw new Error(t("errorMessages.unauthorizedToInvite"));
      }
      const requestedRoleName = isAdminInvite
        ? USER_ROLE.SUPER_ADMIN
        : role || USER_ROLE.USER;
      if (!inviterIsSuperAdmin && requestedRoleName === USER_ROLE.SUPER_ADMIN) {
        throw new Error(t("errorMessages.unauthorizedToInvite"));
      }
      const allowedForNonSuperAdmin: string[] = [USER_ROLE.USER, USER_ROLE.MANAGER];
      const roleNameToAssign = inviterIsSuperAdmin
        ? requestedRoleName
        : allowedForNonSuperAdmin.includes(requestedRoleName)
          ? requestedRoleName
          : USER_ROLE.USER;

      // Determine role to assign
      const selectedRole = await prisma.role.findFirst({
        where: {
          name: roleNameToAssign,
        },
      });
      const invitingUserData = await prisma.user.findUnique({
        where: { id: invitingUser.id },
        include: { role: true, company: true },
      });

      if (invitingUserData?.lang_code) {
        await i18n.changeLanguage(invitingUserData.lang_code);
      } else {
        await i18n.changeLanguage("en");
      }
      if (!selectedRole) {
        throw new Error(t("errorMessages.roleNotFound"));
      }

      let managerId: string | null = null;
      let companyId: string | null = null;

      if (isAdminInvite) {
        // Admin invitation: no manager or company
        managerId = null;
        companyId = null;
      } else if (isContactManager(invitingUser)) {
        // Contact manager inviting: assign self as manager
        managerId = invitingUser.id;
        companyId = invitingUser.company_id;
      } else if (isSuperAdminUser(invitingUser) && inputCompanyId) {
        // Super admin inviting a company user
        companyId = inputCompanyId;

        const managerRole = await prisma.role.findFirst({
          where: { name: USER_ROLE.MANAGER },
        });

        if (!managerRole) {
          throw new Error(t("errorMessages.managerRoleNotFound"));
        }

        const companyManager = await prisma.user.findFirst({
          where: {
            role_id: managerRole.id,
            company_id: inputCompanyId,
          },
        });

        if (!companyManager && selectedRole.name !== USER_ROLE.MANAGER) {
          throw new Error(t("errorMessages.noManagerFound"));
        }

        managerId = companyManager?.id;
      } else {
        throw new Error(t("errorMessages.unauthorizedToInvite"));
      }

      const password_token = uuidv4();

      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          phone_number: phone_number || null,
          role_id: selectedRole.id,
          status: STATUS.ACTIVE,
          is_verified: true,
          manager_id: managerId,
          company_id: companyId,
          password_token,
        },
      });

      if (!newUser) {
        throw new Error(t("errorMessages.failedToCreateUser"));
      }

      // Create user settings with default notification preferences
      await this.createDefaultNotificationPrefrences(newUser.id);
      const inviteUrl = `${process.env.APP_URL}/auth/create-password?email=${email}&token=${password_token}`;
      await mailService.sendInvitationEmail(
        email,
        inviteUrl,
        newUser.name,
        invitingUser.name,
        isAdminInvite,
        invitingUserData?.lang_code || newUser?.lang_code || "en"
      );

      return newUser;
    } catch (error: any) {
      console.log("Error while creating user ", error?.message || error);
      throw new Error(error?.message || t("errorMessages.failedToCreateUser"));
    }
  },

  async inviteUsers(
    emails: string[],
    manager: {
      id: string;
      name: string;
      company_id: string | null;
      lang_code?: string;
    },
    role: "user" | "manager" = "user"
  ) {
    const i18n = await initializeI18n();
    const t = i18n.t;
    const results = [];
    const roleName = role === "manager" ? "manager" : "user";
    const inviteRole = await prisma.role.findFirst({
      where: { name: roleName },
    });
    await i18n.changeLanguage(manager?.lang_code || "en");
    if (!inviteRole) {
      throw new Error(t("errorMessages.userRoleNotFound"));
    }

    // Link new members to the team root, so co-managers and salespeople all
    // share one team. A co-manager inheriting the team also invites into it.
    const inviter = await prisma.user.findUnique({
      where: { id: manager.id },
      select: { manager_id: true },
    });
    const rootManagerId = inviter?.manager_id ?? manager.id;

    for (const email of emails) {
      try {
        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) {
          console.warn(`Skipping invite. Email already registered: ${email}`);
          results.push({ email, status: "Already Registered" });
          continue;
        }

        const password_token = uuidv4();
        const name = email.split("@")[0];

        const user = await prisma.user.create({
          data: {
            email,
            name,
            password_token,
            manager_id: rootManagerId,
            role_id: inviteRole.id,
            status: STATUS.ACTIVE,
            company_id: manager?.company_id,
            is_verified: true,
          },
        });

        if (!user) {
          console.error(`Failed to create user for email: ${email}`);
          continue;
        }

        // Create user settings with default notification preferences
        await this.createDefaultNotificationPrefrences(user.id);
        const inviteUrl = `${process.env.APP_URL}/auth/create-password?email=${email}&token=${password_token}`;
        await mailService.sendInvitationEmail(
          email,
          inviteUrl,
          user.name,
          manager.name,
          false,
          manager?.lang_code || "en"
        );

        results.push({ email, status: "Invited", userId: user.id });
      } catch (err: any) {
        console.error(`Failed to invite ${email}:`, err?.message || err);
        results.push({
          email,
          status: "Failed",
          error: err?.message || "Unknown error",
        });
      }
    }

    return results;
  },

  async updatePassword(
    userId: string,
    userData: { oldPassword: string; newPassword: string }
  ) {
    const i18n = await initializeI18n();
    const t = i18n.t;
    try {
      const { oldPassword, newPassword } = userData;

      // Fetch user from database
      const user = await prisma.user.findUnique({ where: { id: userId } });
      await i18n.changeLanguage(user?.lang_code || "en");
      if (!user) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.userNotFound") }),
          { status: 404 }
        );
      }

      // Verify the old password
      const isMatch = await bcrypt.compare(oldPassword, user?.password);
      if (!isMatch) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.oldPasswordIncorrect") }),
          { status: 400 }
        );
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the password in the database
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
        include: { company: true },
      });

      // Sync updated password to LMS (fire and forget)
      syncUserToLMSAsync(
        {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          password: hashedPassword,
          phone_number: updatedUser.phone_number,
        },
        updatedUser.company ? {
          id: updatedUser.company.id,
          name: updatedUser.company.title,
          email: updatedUser.company.email,
        } : null
      );

      return new Response(
        JSON.stringify({ message: t("successMessages.passwordUpdated") }),
        { status: 200 }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          message: t("errorMessages.errorUpdatingPassword"),
          error,
        }),
        { status: 500 }
      );
    }
  },

  async updateUserPreferences(userId: string, preferences: any) {
    try {
      // Find if user settings exist
      let userSettings = await prisma.userSetting.findFirst({
        where: { user_id: userId },
      });

      if (!userSettings) {
        // Create create settings if not found
        userSettings = await prisma.userSetting.create({
          data: {
            user_id: userId,
            notification_setting: preferences,
          },
        });
      } else {
        // Update existing settings
        userSettings = await prisma.userSetting.update({
          where: { id: userSettings.id },
          data: {
            notification_setting: preferences,
          },
        });
      }

      return userSettings;
    } catch (error: any) {
      throw new Error(error.message || "Error updating user preferences.");
    }
  },

  async deleteUser(userId: string) {
    try {
      // Fetch user data (including avatar path and email for LMS sync)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatar: true, email: true },
      });

      if (!user) {
        throw new Error("User not found.");
      }

      // Fetch all conversations of the user to delete associated summaries & files
      const conversations = await prisma.userConversation.findMany({
        where: { user_id: userId },
        select: { id: true, file_path: true },
      });

      const conversationIds = conversations.map((conv) => conv.id);

      // Delete conversation files first
      conversations.forEach((conv) => {
        if (conv.file_path) {
          const filePath = path.join(
            process.cwd(),
            "public",
            conv.file_path.replace(/^\/+/, "")
          );
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      });

      // Delete conversation summaries before deleting conversations
      if (conversationIds.length > 0) {
        await prisma.conversationSummary.deleteMany({
          where: { conversation_id: { in: conversationIds } },
        });
      }

      // Delete user's avatar file (if stored locally)
      if (user.avatar) {
        const avatarPath = path.join(
          process.cwd(),
          "public",
          user.avatar.replace(/^\/+/, "")
        );
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
        }
      }

      // Delete user-related data in a transaction
      await prisma.$transaction([
        prisma.userSetting.deleteMany({ where: { user_id: userId } }),
        prisma.userConversation.deleteMany({ where: { user_id: userId } }),
        prisma.customer.deleteMany({ where: { user_id: userId } }),
      ]);

      // Finally, delete the user
      await prisma.user.delete({ where: { id: userId } });

      // Delete user from LMS (fire and forget)
      deleteUserFromLMSAsync(userId, user.email);

      return { message: "User and all associated data deleted successfully." };
    } catch (error: any) {
      throw new Error(error.message || "Error deleting user.");
    }
  },

  /**
   * Creates default notification preferences for a user when they are created.
   * Default settings are:
   * - Reminders: Email enabled
   * @param {string} userId - ID of the user to create preferences for.
   * @returns {Promise<void>}
   */
  async createDefaultNotificationPrefrences(userId: string) {
    await prisma.userSetting.create({
      data: {
        user_id: userId,
        notification_setting: { reminders: { email: true } },
      },
    });
  },

  async updateUserLanguagePreferences(userId: string, langCode: string) {
    try {
      const user = await UserModel.updateUserLangPreference(userId, langCode);
      if (!user) {
        throw new Error("User not found.");
      }
      return { user };
    } catch (error: any) {
      throw new Error(
        error.message || "Error updating user language preferences."
      );
    }
  },

  async getUserLanguagePreferences(userId: string) {
    try {
      const langCode = await UserModel.getUserLangPreference(userId);
      return {
        lang_code: langCode,
      };
    } catch (error: any) {
      console.error(
        "Error fetching user language preferences in services:",
        error
      );
      throw new Error(
        error.message || "Error fetching user language preferences."
      );
    }
  },
};
