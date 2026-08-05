import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import { UserService } from "@/app/api/services/userService";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/learning/admin/users/bulk — bulk-gebruikersupload via CSV
 * (LMS 1:1 P6, port van productie /api/users/bulk + BulkUserUploadDialog).
 * Multipart: `file` = CSV met kolommen (NL of EN koppen):
 *   name/naam, email/e-mail, phone/telefoon, learning_role/leerrol
 * Iedere rij wordt via de normale uitnodigingsflow aangemaakt (dus mét
 * uitnodigingsmail, géén standaardwachtwoord zoals de oude LMS deed).
 * Antwoord: { successful: [...], failed: [{row, email, error}] }.
 */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const user = (req as any).user;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "invalid_form" }, { status: 400 });
  }
  const fileEntry = formData.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return NextResponse.json({ message: "no_file" }, { status: 400 });
  }

  const Papa = (await import("papaparse")).default;
  const csvText = Buffer.from(await fileEntry.arrayBuffer()).toString("utf-8");
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase(),
  });
  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return NextResponse.json(
      { message: "csv_parse_failed", details: parsed.errors },
      { status: 400 },
    );
  }

  const successful: { row: number; email: string }[] = [];
  const failed: { row: number; email: string; error: string }[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const email = (row.email || row["e-mail"] || "").trim();
    const name = (row.name || row.naam || "").trim();
    const rowNum = i + 2; // +1 koprij, +1 1-index
    if (!email || !name) {
      failed.push({ row: rowNum, email, error: "missing_name_or_email" });
      continue;
    }
    try {
      await UserService.createUser(
        {
          name,
          email,
          phone_number: (row.phone || row.telefoon || "").trim() || undefined,
          learning_role:
            (row.learning_role || row.leerrol || "").trim() || undefined,
        },
        user,
      );
      successful.push({ row: rowNum, email });
    } catch (error: any) {
      failed.push({
        row: rowNum,
        email,
        error: String(error?.message || "create_failed"),
      });
    }
  }

  return NextResponse.json({ data: { successful, failed } });
}
