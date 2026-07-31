import { prisma } from "../utils/prisma";

export class CustomerModel {
  static async findCustomerByName(user_id: string, name: string) {
    return prisma.customer.findFirst({
      where: {
        name,
        user_id: user_id,
      },
    });
  }

  static async createCustomer(user_id: string, name: string) {
    return prisma.customer.create({ data: { user_id, name } });
  }

  static async getCustomers(user_id: string) {
    return prisma.customer.findMany({
      where: {
        user_id: user_id,
      },
    });
  }
}
