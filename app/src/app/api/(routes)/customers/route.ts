import { NextRequest } from "next/server";
import { CustomerController } from "../../controllers/customerController";
import { authMiddleware } from "../../middleware/authMiddleware";

export async function GET(req: NextRequest) {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;

    return CustomerController.getCustomers(req);
}