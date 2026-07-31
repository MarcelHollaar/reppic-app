import { prisma } from "../utils/prisma";
import { CustomerModel } from "../models/customer";

export const CustomerService = {
  async getCustomers(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });

      if (!user) {
        throw new Error("User not found.");
      }

      return await CustomerModel.getCustomers(userId);
    } catch (error: any) {
      throw new Error(error?.message || "Error getting user profile.");
    }
  },
};
