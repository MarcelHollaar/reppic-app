import { STATUS, USER_ROLE } from "@/configs/constants";
import { prisma } from "../utils/prisma";
import { UserModel } from "../models/user";
import { NextRequest } from "next/server";
import { CompanyModel } from "../models/company";
import { mailService } from "./mailService";
import { v4 as uuidv4 } from "uuid";
import { deleteUserFromLMSAsync } from "@/lib/services/lms-sync";

export const CompanyService = {
  /**
   * Create or update users for the company.
   */
  async createOrUpdateCompanyUsers(
    users: any[],
    companyId: string,
    t?: any,
    langCode?: string
  ) {
    const manager = await prisma.user.findFirst({
      where: {
        company_id: companyId,
        role: {
          name: "manager",
        },
      },
    });

    const createdOrUpdatedUsers = await Promise.all(
      users.map(async (user) => {
        const role = await prisma.role.findFirst({
          where: { name: user.role },
        });

        if (!role) {
          throw new Error(`Role '${user.role}' not found`);
        }

        user.email = user.email.toLowerCase();

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (existingUser) {
          const superAdminRole = await prisma.role.findFirst({
            where: { name: USER_ROLE.SUPER_ADMIN },
          });
          if (superAdminRole?.id === existingUser?.role_id) {
            throw new Error(t("errorMessages.emailAlreadyTaken"));
          } else if (existingUser?.company_id !== companyId) {
            throw new Error(t("errorMessages.emailAlreadyTaken"));
          }
          // If user exists, update info but don't send invitation
          return prisma.user.update({
            where: { email: user.email },
            data: {
              name: user.name,
              role_id: role.id,
              company_id: companyId,
            },
          });
        } else {
          // Create new user and send invitation
          const password_token = uuidv4();
          const newUser = await prisma.user.create({
            data: {
              name: user.name,
              email: user.email,
              role_id: role.id,
              company_id: companyId,
              status: STATUS.ACTIVE,
              is_verified: true,
              password_token,
            },
          });

          const inviteUrl = `${process.env.APP_URL}/auth/create-password?email=${newUser.email}&token=${password_token}`;

          await mailService.sendInvitationEmail(
            newUser.email,
            inviteUrl,
            newUser.name,
            manager?.name || t("common.admin"),
            false,
            manager?.lang_code || langCode || "en"
          );

          return newUser;
        }
      })
    );

    return createdOrUpdatedUsers;
  },
  async upsertCompanyAndInviteFromWebhook(input: {
    companyName: string;
    user: { name: string; email: string; phone?: string };
    maxUsers: number;
    langCode?: string;
  }) {
    const email = input.user.email.trim().toLowerCase();
    const name = input.user.name.trim();
    const phone = input.user.phone?.trim();
    const maxUsers = input.maxUsers;

    return prisma.$transaction(async (tx) => {
      const managerRole = await tx.role.findFirst({
        where: { name: USER_ROLE.MANAGER },
        select: { id: true },
      });
      if (!managerRole) {
        throw new Error(`Role '${USER_ROLE.MANAGER}' not found`);
      }

      const company = await tx.company.upsert({
        where: {
          email_title_unique: {
            email,
            title: input.companyName.trim(),
          },
        },
        update: {
          contact_person: name,
          phone,
          updated_at: new Date(),
        },
        create: {
          title: input.companyName.trim(),
          contact_person: name,
          email,
          phone,
          notes: "",
          max_users: maxUsers,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true, company_id: true, role_id: true, name: true },
      });

      if (
        existingUser &&
        existingUser.company_id &&
        existingUser.company_id !== company.id
      ) {
        throw new Error("Email already in use by a different company");
      }

      let user = existingUser
        ? await tx.user.update({
            where: { email },
            data: {
              name,
              company_id: company.id,
              role_id: managerRole.id,
              status: STATUS.ACTIVE,
              is_verified: true,
              updated_at: new Date(),
            },
            select: { id: true, name: true, company_id: true },
          })
        : await tx.user.create({
            data: {
              name,
              email,
              company_id: company.id,
              role_id: managerRole.id,
              status: STATUS.ACTIVE,
              is_verified: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
            select: { id: true, name: true, company_id: true },
          });

      const password_token = uuidv4();
      await tx.user.update({
        where: { id: user.id },
        data: { password_token },
      });

      const managerSender = await tx.user.findFirst({
        where: { company_id: company.id },
        orderBy: { created_at: "asc" },
        select: { name: true, lang_code: true },
      });

      const inviteUrl = `${
        process.env.APP_URL
      }/auth/create-password?email=${encodeURIComponent(
        email
      )}&token=${encodeURIComponent(password_token)}`;

      await mailService.sendInvitationEmail(
        email,
        inviteUrl,
        name,
        managerSender?.name || "Admin",
        false,
        managerSender?.lang_code || input.langCode || "en"
      );

      return { company, userId: user.id, inviteUrl };
    });
  },

  /**
   * Create or update a company, and optionally its users.
   */
  async createCompanyWithUsers(
    body: any,
    creatorId: string,
    t?: any,
    langCode?: string
  ) {
    // if (body.users?.length === 0) {
    //   throw new Error(t("errorMessages.managerRoleIsRequired"));
    // }
    // 1. Upsert company
    const company = await prisma.company.upsert({
      where: {
        email_title_unique: {
          email: body.email,
          title: body.title,
        },
      },
      update: {
        contact_person: body.contact_person,
        phone: body.phone,
        notes: body.notes,
        max_users: body.max_users,
        updated_at: new Date(),
      },
      create: {
        title: body.title,
        contact_person: body.contact_person,
        email: body.email,
        phone: body.phone,
        notes: body.notes,
        max_users: body.max_users,
        updated_at: new Date(),
        created_at: new Date(),
      },
    });

    // 2. Create or update users
    let users: any = [];
    if (body.users?.length) {
      users = await this.createOrUpdateCompanyUsers(
        body.users,
        company.id,
        t,
        langCode
      );
    }

    return company;
  },

  /**
   * Fetch a company by its ID.
   * @param companyId - The ID of the company to fetch.
   * @returns The company with the given ID.
   */
  async getCompanyById(companyId: string) {
    return prisma.company.findUnique({
      where: { id: companyId },
    });
  },

  /**
   * Updates a company with the given ID and also creates or updates users
   * associated with the company.
   *
   * @param companyId - The ID of the company to update.
   * @param body - The data to update the company with, including the company's
   *              title, contact person, phone number, and notes. Also
   *              includes an array of removed users to delete and an array of
   *              users to create or update.
   * @returns The updated company.
   */
  async updateCompanyWithUsers(
    companyId: string,
    body: any,
    t?: any,
    langCode?: string,
    loggedInUser?: any
  ) {
    const existingCompany = await prisma.company.findUnique({
      where: { id: companyId },
    });
    const managerRole = await prisma.role.findFirst({
      where: { name: USER_ROLE.MANAGER },
    });
    // to not update the all existing users with manager role with user role if it results in not having a single manager in the company
    if (Array.isArray(body.users) && body.users.length > 0) {
      if (!managerRole) {
        throw new Error(t("errorMessages.managerRoleNotFound"));
      }

      // Unique role names from input
      const uniqueRoleNames = [...new Set(body.users.map((u: any) => u.role))];

      // Resolve all role IDs
      const roles = await prisma.role.findMany({
        where: {
          name: { in: uniqueRoleNames },
        },
      });

      const roleNameToIdMap = new Map(roles.map((r) => [r.name, r.id]));

      // Find current managers
      const companyManagers = await prisma.user.findMany({
        where: {
          role_id: managerRole.id,
          company_id: companyId,
        },
      });

      //  Check if all managers are being changed
      const managersBeingChanged = companyManagers.filter((mgr) =>
        body.users.some((u: any) => {
          const newRoleId = roleNameToIdMap.get(u.role);
          return u.email === mgr.email && newRoleId !== managerRole.id;
        })
      );

      if (managersBeingChanged.length === companyManagers.length) {
        throw new Error(t("errorMessages.managerRoleIsRequired"));
      }
    }

    if (!existingCompany) {
      throw new Error("Company not found");
    }

    if (
      loggedInUser?.role?.id === managerRole?.id &&
      loggedInUser?.company_id === existingCompany.id &&
      existingCompany?.max_users !== body?.max_users
    ) {
      throw new Error(t("errorMessages.onlySuperAdminCanChangeMaxUsers"));
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        title: body.title,
        contact_person: body.contact_person,
        phone: body.phone,
        notes: body.notes,
        max_users: body.max_users,
        updated_at: new Date(),
      },
    });

    if (Array.isArray(body.removed_users) && body.removed_users.length > 0) {
      const userIds = body.removed_users;

      // Fetch user emails before deleting (needed for LMS sync)
      const usersToDelete = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
      });

      // 1. Delete related records in dependent tables
      await prisma.userSetting.deleteMany({
        where: {
          user_id: { in: userIds },
        },
      });

      await prisma.notification.deleteMany({
        where: {
          user_id: { in: userIds },
        },
      });

      await prisma.passwordReset.deleteMany({
        where: {
          user_id: { in: userIds },
        },
      });

      await prisma.emailVerification.deleteMany({
        where: {
          user_id: { in: userIds },
        },
      });

      await prisma.videoProgress.deleteMany({
        where: {
          user_id: { in: userIds },
        },
      });

      await prisma.suggestedVideo.deleteMany({
        where: {
          user_id: { in: userIds },
        },
      });

      await prisma.video.deleteMany({
        where: {
          uploaded_by: { in: userIds },
        },
      });

      // Get conversation IDs for these users to delete summaries first
      const userConversations = await prisma.userConversation.findMany({
        where: { user_id: { in: userIds } },
        select: { id: true },
      });
      const conversationIds = userConversations.map((c) => c.id);

      // Delete conversation summaries first (foreign key constraint)
      // Both ConversationSummary and ConversationSummaryX reference user_conversations
      if (conversationIds.length > 0) {
        await prisma.conversationSummary.deleteMany({
          where: {
            conversation_id: { in: conversationIds },
          },
        });
        await prisma.conversationSummaryX.deleteMany({
          where: {
            conversation_id: { in: conversationIds },
          },
        });
      }

      await prisma.userConversation.deleteMany({
        where: {
          user_id: { in: userIds },
        },
      });

      await prisma.customer.deleteMany({
        where: {
          user_id: { in: userIds },
        },
      });

      // 2. Delete the users
      await prisma.user.deleteMany({
        where: {
          id: { in: userIds },
          company_id: companyId,
        },
      });

      // 3. Delete users from LMS (fire and forget)
      usersToDelete.forEach((user) => {
        deleteUserFromLMSAsync(user.id, user.email);
      });
    }

    if (Array.isArray(body.users) && body.users.length > 0) {
      await this.createOrUpdateCompanyUsers(body.users, companyId, t, langCode);
    }

    return updatedCompany;
  },

  /**
   * Fetches users associated with a specific company.
   *
   * @param companyId - The ID of the company whose users are to be fetched.
   * @param req - The NextRequest object containing the request data.
   * @returns A JSON response containing the list of users if successful,
   *          or an error message if unauthorized or an error occurs.
   */
  async getCompanyUsers(companyId: string, req: NextRequest) {
    try {
      return await UserModel.getCompanyUsers(companyId, req);
    } catch (error: any) {
      throw new Error(error?.message || "Error getting user profile.");
    }
  },

  /**
   * Fetches all companies, with pagination.
   * @param req The NextRequest object, for reading search parameters.
   * @returns A JSON response containing the list of companies if successful,
   *          or an error message if unauthorized or an error occurs.
   */
  async getCompanies(req: NextRequest) {
    try {
      return await CompanyModel.getComapanies(req);
    } catch (error: any) {
      throw new Error(error?.message || "Error getting companies.");
    }
  },

  /**
   * Deletes a company and all its associated data, including users, customers,
   * user conversations, conversation summaries, and notifications.
   * @param companyId - The ID of the company to delete.
   * @returns The deleted company.
   */
  async deleteCompany(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        users: {
          include: {
            user_conversations: true,
            user_customers: true,
          },
        },
      },
    });

    if (!company) {
      throw new Error("Company not found.");
    }

    const userIds = company.users.map((user) => user.id);
    const customerIds = company.users.flatMap((user) =>
      user.user_customers.map((c) => c.id)
    );
    const conversationIds = company.users.flatMap((user) =>
      user.user_conversations.map((conv) => conv.id)
    );

    // 1. Delete conversation summaries for only these conversations
    await prisma.conversationSummary.deleteMany({
      where: {
        conversation_id: { in: conversationIds },
      },
    });

    // 2. Delete user conversations for only these users
    await prisma.userConversation.deleteMany({
      where: {
        id: { in: conversationIds },
        user_id: { in: userIds },
      },
    });

    // 3. Delete notifications for only these users
    await prisma.notification.deleteMany({
      where: {
        user_id: { in: userIds },
      },
    });

    // 4. Delete password resets for only these users
    await prisma.passwordReset.deleteMany({
      where: {
        user_id: { in: userIds },
      },
    });

    // 5. Delete email verifications for only these users
    await prisma.emailVerification.deleteMany({
      where: {
        user_id: { in: userIds },
      },
    });

    // 6. Delete video progress for only these users
    await prisma.videoProgress.deleteMany({
      where: {
        user_id: { in: userIds },
      },
    });

    // 7. Delete suggested videos for only these users
    await prisma.suggestedVideo.deleteMany({
      where: {
        user_id: { in: userIds },
      },
    });

    // 8. Delete uploaded videos for only these users
    await prisma.video.deleteMany({
      where: {
        uploaded_by: { in: userIds },
      },
    });

    // 9. Delete user settings for only these users
    await prisma.userSetting.deleteMany({
      where: {
        user_id: { in: userIds },
      },
    });

    // 10. Delete customers for only these users
    await prisma.customer.deleteMany({
      where: {
        id: { in: customerIds },
        user_id: { in: userIds },
      },
    });

    // 11. Delete users for only this company
    await prisma.user.deleteMany({
      where: {
        id: { in: userIds },
        company_id: companyId,
      },
    });

    // 12. Delete the company itself
    return await prisma.company.delete({
      where: { id: companyId },
    });
  },
};
