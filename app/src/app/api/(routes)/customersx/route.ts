import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { CustomerModel } from "@/app/api/models/customer";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;

    const user = (req as any).user;
    if (!user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { message: "Customer name is required" },
        { status: 400 }
      );
    }

    const customer = await CustomerModel.createCustomer(user.id, name.trim());

    return NextResponse.json(
      {
        message: "Customer created successfully",
        data: customer
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Failed to create customer" },
      { status: 500 }
    );
  }
}

