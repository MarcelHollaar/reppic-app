import { NextRequest, NextResponse } from "next/server";
import { UserService } from "../services/userService";
import {
  getEmailSchema,
  getFileSchema,
  getNameSchema,
  getPasswordSchema,
} from "../validation/user";
import { USER_ROLE } from "@/configs/constants";
import { prisma } from "../utils/prisma";
import { initializeI18n, canManageTargetUser } from "../helpers/userHelper";

export class UserController {
  static async getProfile(req: NextRequest) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      const userProfile = await UserService.getUserProfile(user.id);

      return NextResponse.json(
        { message: "User profile fetched.", data: userProfile },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json(
        { message: error.message || "" },
        { status: 500 }
      );
    }
  }

  static async updateProfile(req: NextRequest, langCode?: string) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      const formData = await req.formData();
      const body: any = Object.fromEntries(formData.entries());
      const i18n = await initializeI18n();
      if (langCode) {
        await i18n.changeLanguage(langCode);
      }
      const t = i18n.t;
      // Validation
      body.email = body.email.toLowerCase();
      const emailSchema = getEmailSchema(t);
      const nameSchema = getNameSchema(t);
      const fileSchema = getFileSchema(t);
      // Validation
      // phoneSchema.parse(body.phone_number);
      nameSchema.parse(body.name);
      emailSchema.parse(body.email);

      // Email uniqueness check
      const existingUser = await prisma.user.findFirst({
        where: {
          email: body.email,
          NOT: { id: user.id },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { message: "Email is already taken." },
          { status: 400 }
        );
      }

      const file = formData.get("file") as File | null;
      let fileBuffer = null;
      let fileName = "";

      if (file) {
        fileSchema.parse(body.file);
        fileBuffer = await file.arrayBuffer();
        fileName = file.name;
      }
      const updatedUser = await UserService.updateUserProfile(
        user.id,
        body,
        fileBuffer,
        fileName
      );

      return NextResponse.json(
        { message: "Profile updated successfully.", data: updatedUser },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }

  static async addUser(req: NextRequest, langCode?: string) {
    try {
      const loggedInUser = (req as any).user;
      const formData = await req.formData();
      const body: any = Object.fromEntries(formData.entries());
      const isAdminInvite = body.admin_invite === "true";
      const i18n = await initializeI18n();
      if (langCode) {
        await i18n.changeLanguage(langCode);
      }
      const t = i18n.t;
      // Validation
      body.email = body.email.toLowerCase();
      const emailSchema = getEmailSchema(t);
      const nameSchema = getNameSchema(t);
      emailSchema.parse(body.email);
      nameSchema.parse(body.name);

      // Check if email is already in the database
      const existingUser = await prisma.user.findUnique({
        where: {
          email: body.email,
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { message: "Email already taken." },
          { status: 400 }
        );
      }

      const createdUser = await UserService.createUser(
        body,
        loggedInUser,
        isAdminInvite
      );

      return NextResponse.json(
        { message: "Company user invited successfully.", data: createdUser },
        { status: 200 }
      );
    } catch (error: any) {
      console.log("error while inviting user ", error?.message);
      return NextResponse.json(
        { message: error?.message || error },
        { status: 500 }
      );
    }
  }

  static async inviteUsers(req: NextRequest) {
    try {
      const user = (req as any).user;
      if (!user || user?.role?.name != USER_ROLE.MANAGER) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      const body = await req.json();
      if (!Array.isArray(body.emails)) {
        return NextResponse.json(
          { message: "Invalid data format. 'emails' should be an array." },
          { status: 400 }
        );
      }

      const emails = body.emails.map((email: string) =>
        email.trim().toLowerCase()
      );

      // Optional role: a manager may invite a salesperson ("user", default) or
      // a co-manager ("manager") who then sees the same team.
      const inviteRole = body.role === "manager" ? "manager" : "user";

      const results = await UserService.inviteUsers(
        emails,
        user,
        inviteRole,
        body.learning_role
      );

      return NextResponse.json(
        { message: "Invitations sent successfully.", data: results },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }

  static async updatePassword(req: NextRequest, langCode?: string) {
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode);
    }
    const t = i18n.t;
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      const body = await req.json();
      // Validation
      const passwordSchema = getPasswordSchema(t);
      passwordSchema.parse(body.newPassword);
      passwordSchema.parse(body.oldPassword);

      return await UserService.updatePassword(user.id, body);
    } catch (error: any) {
      console.log("Error updating password: ", error);
      return new Response(
        JSON.stringify({
          message: t("errorMessages.errorUpdatingPassword"),
          error,
        }),
        { status: 500 }
      );
    }
  }

  static async updateUserPreferences(req: NextRequest, data: any) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      if (!data || !data.notification_preferences) {
        return NextResponse.json(
          { message: "Invalid request data." },
          { status: 400 }
        );
      }

      // Update user settings
      const updatedSettings = await UserService.updateUserPreferences(
        user.id,
        data.notification_preferences
      );

      return NextResponse.json(
        {
          message: "User preferences updated successfully.",
          data: updatedSettings,
        },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json(
        { message: error.message || "Error updating user preferences." },
        { status: 500 }
      );
    }
  }

  static async deleteUser(req: NextRequest) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
      const body = await req.json();
      const userIds: string[] = Array.isArray(body.user_ids) ? body.user_ids : [];

      // Ownership guard: a manager may only delete users in their OWN company
      // (and never a superadmin). Prevents cross-tenant / privilege-escalating
      // deletion by ID. Superadmin may delete anyone.
      for (const userId of userIds) {
        const target = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, company_id: true, role: { select: { name: true } } },
        });
        if (!target || !canManageTargetUser(user, target)) {
          return NextResponse.json(
            { message: "Unauthorized: Insufficient permissions" },
            { status: 403 }
          );
        }
      }

      for (const userId of userIds) {
        await UserService.deleteUser(userId);
      }

      return NextResponse.json(
        { message: "Team member deleted successfully." },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }

  static async getProfileById(req: NextRequest, userId: string) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      // Ownership guard: only self, a manager of the same company, or a
      // superadmin may read a user's full profile (email/phone/company/team).
      // Prevents PII harvesting by enumerating user IDs.
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, company_id: true, role: { select: { name: true } } },
      });
      if (!target || !canManageTargetUser(user, target)) {
        return NextResponse.json(
          { message: "Unauthorized: Insufficient permissions" },
          { status: 403 }
        );
      }

      const userProfile = await UserService.getUserProfile(userId);

      return NextResponse.json(
        { message: "User profile fetched.", data: userProfile },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json(
        { message: error.message || "" },
        { status: 500 }
      );
    }
  }

  static async updateUserLanguagePreferences(req: NextRequest, data: any) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      if (!data || !data.langCode) {
        return NextResponse.json(
          { message: "Invalid request data." },
          { status: 400 }
        );
      }

      // Update user language preferences
      const updatedLanguagePreferences =
        await UserService.updateUserLanguagePreferences(user.id, data.langCode);

      return NextResponse.json(
        {
          message: "User language preferences updated successfully.",
          data: updatedLanguagePreferences,
        },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json(
        {
          message: error.message || "Error updating user language preferences.",
        },
        { status: 500 }
      );
    }
  }

  static async getUserLanguagePreferences(req: NextRequest) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
      const languagePreferences = await UserService.getUserLanguagePreferences(
        user.id
      );

      return NextResponse.json(
        {
          message: "User language preferences fetched successfully.",
          data: languagePreferences,
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.log("Error fetching user language preferences:", error);
      return NextResponse.json(
        {
          message: error.message || "Error fetching user language preferences.",
        },
        { status: 500 }
      );
    }
  }
}
