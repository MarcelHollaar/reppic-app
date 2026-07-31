import { prisma } from "../utils/prisma";
import { NextRequest } from "next/server";
import { UserModel } from "../models/user";

export const TeamMemberService = {
  async getTeamMembers(userId: string, req: NextRequest) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });

      if (!user) {
        throw new Error("User not found.");
      }

      return await UserModel.getTeamMembers(userId, req);
    } catch (error: any) {
      throw new Error(error?.message || "Error getting user profile.");
    }
  },

  async getAdminUsers(req: NextRequest) {
    try {
      return await UserModel.getAdminUsers(req);
    } catch (error: any) {
      throw new Error(error?.message || "Error getting user admins.");
    }
  },
};
