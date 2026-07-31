import { NextRequest, NextResponse } from "next/server";
import { CustomerService } from "../services/customerService";

export class CustomerController {
    static async getCustomers(req: NextRequest) {
        try {
            const user = (req as any).user;
            if (!user) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }

            const customers = await CustomerService.getCustomers(user.id);
            return NextResponse.json({ message: "Customers fetched successfully.", data: customers }, { status: 200 });
        } catch (error: any) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
    }
}