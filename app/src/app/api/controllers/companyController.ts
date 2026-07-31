import { NextRequest, NextResponse } from "next/server";
import {
  getEmailSchema,
  getTitleSchema,
} from "../validation/companyValidation";
import { CompanyService } from "../services/companyService";
import { initializeI18n, canActOnCompany } from "../helpers/userHelper";

export class CompanyController {
  /**
   * Creates a new company and its associated users.
   *
   * @param req - The incoming Next.js request object containing the user session and company data.
   * @returns A NextResponse object with a success message and the created company data if successful,
   *          or an error message if unauthorized or if there is an error during creation.
   *
   * Validates the phone number, title, and email from the request body before proceeding with the creation.
   */
  static async createCompanyWithUsers(req: NextRequest, langCode?: string) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 },
        );
      }

      const body = await req.json();
      // phoneSchema.parse(body.phone);
      const i18n = await initializeI18n();
      if (langCode) {
        await i18n.changeLanguage(langCode);
      }
      const t = i18n.t;
      // Validation
      body.email = body.email.toLowerCase();
      const emailSchema = getEmailSchema(t);
      const titleSchema = getTitleSchema(t);
      titleSchema.parse(body.title);
      emailSchema.parse(body.email);
      const company = await CompanyService.createCompanyWithUsers(
        body,
        user.id,
        t,
        langCode,
      );

      return NextResponse.json(
        { message: "Company created", company },
        { status: 201 },
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
  }

  static async createCompanyFromWebhook(
    user: { name: string; email: string; phone?: string },
    companyName: string,
  ) {
    try {
      user.email = user.email.toLowerCase();
      const newCompany = {
        title: companyName,
        contact_person: user.name,
        email: user.email.toLowerCase(),
        phone: user.phone ?? "",
        notes: "",
        max_users: 5,
        users: [
          {
            name: user.name,
            email: user.email.toLowerCase(),
            role: "manager",
          },
        ],
      };
      const company = await CompanyService.createCompanyWithUsers(
        newCompany,
        "Webhook",
      );
      return NextResponse.json({
        message: "Company created with user",
        company,
      });
    } catch (e) {
      return NextResponse.json(
        { message: "Something went wrong" },
        { status: 400 },
      );
    }
  }

  /**
   * Get company details by ID
   * @param req NextRequest
   * @param companyId string
   * @returns NextResponse
   */
  static async getCompanyDetailsById(req: NextRequest, companyId: string) {
    try {
      // Tenant guard: a contact-manager passes the invite gate but may only
      // read its OWN company — never an arbitrary companyId (cross-tenant IDOR).
      if (!canActOnCompany((req as any).user, companyId)) {
        return NextResponse.json(
          { message: "Unauthorized: Insufficient permissions" },
          { status: 403 },
        );
      }

      const company = await CompanyService.getCompanyById(companyId);

      if (!company) {
        return NextResponse.json(
          { message: "Company not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({ data: company }, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
  }

  /**
   * Update a company with the given ID
   * @param companyId - The ID of the company to update.
   * @param req - The NextRequest object
   * @returns - NextResponse
   */
  static async updateCompany(
    companyId: string,
    req: NextRequest,
    langCode?: string,
  ) {
    try {
      const user = (req as any).user;

      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 },
        );
      }

      // Tenant guard: non-superadmins may only update their OWN company.
      if (!canActOnCompany(user, companyId)) {
        return NextResponse.json(
          { message: "Unauthorized: Insufficient permissions" },
          { status: 403 },
        );
      }

      const body = await req.json();
      // phoneSchema.parse(body.phone);
      const i18n = await initializeI18n();

      if (langCode) {
        await i18n.changeLanguage(langCode);
      }

      const t = i18n.t;
      // Validation
      body.email = body.email.toLowerCase();

      const emailSchema = getEmailSchema(t);
      const titleSchema = getTitleSchema(t);

      titleSchema.parse(body.title);
      emailSchema.parse(body.email);

      const company = await CompanyService.updateCompanyWithUsers(
        companyId,
        body,
        t,
        langCode,
        user,
      );

      return NextResponse.json(
        { message: "Company updated", company },
        { status: 201 },
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
  }

  /**
   * Fetches users associated with a specific company.
   *
   * @param companyId - The ID of the company whose users are to be fetched.
   * @param req - The NextRequest object containing the request data.
   * @returns A JSON response containing the list of users if successful,
   *          or an error message if unauthorized or an error occurs.
   */
  static async getCompanyUsers(companyId: string, req: NextRequest) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 },
        );
      }

      // Tenant guard: non-superadmins may only list their OWN company's users.
      if (!canActOnCompany(user, companyId)) {
        return NextResponse.json(
          { message: "Unauthorized: Insufficient permissions" },
          { status: 403 },
        );
      }

      const conversations = await CompanyService.getCompanyUsers(
        companyId,
        req,
      );
      return NextResponse.json(
        { message: "Company users fetched", data: conversations },
        { status: 200 },
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }

  /**
   * Fetches all companies, handling pagination and search parameters if applicable.
   *
   * @param req - The NextRequest object containing the request data, including any search parameters.
   * @returns A JSON response containing the list of companies if successful,
   *          or an error message if an error occurs.
   */

  static async getCompanies(req: NextRequest) {
    try {
      const conversations = await CompanyService.getCompanies(req);
      return NextResponse.json(
        { message: "Companies fetched", data: conversations },
        { status: 200 },
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }

  /**
   * Deletes a company and all its associated data, including users, customers,
   * user conversations, conversation summaries, and notifications.
   * @param companyId - The ID of the company to delete.
   * @returns The deleted company.
   */
  static async deleteCompany(companyId: string, langCode?: string) {
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode);
    }
    const t = i18n.t;
    try {
      const company = await CompanyService.deleteCompany(companyId);

      return NextResponse.json(
        { message: "Company deleted", company },
        { status: 201 },
      );
    } catch (error: any) {
      console.log("Error while deleting company", error?.message || error);
      return NextResponse.json(
        { message: t("errorMessages.failedToDelete") },
        { status: 400 },
      );
    }
  }
}
