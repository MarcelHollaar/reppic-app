import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware, authMiddleware } from "../../../../middleware/authMiddleware";
import { LEARNING_ROLE, USER_ROLE } from "@/configs/constants";
import {
  learningHelpService,
  helpRoleFor,
} from "@/lib/services/learningHelpService";

/**
 * GET /api/learning/help/articles?lang=&q=&page=&all=1
 * - zonder q/page: gepubliceerde artikelen voor de rol (productie /api/help/articles)
 * - q=…: zoeken (productie /articles/search)
 * - page=…: artikelen voor een paginacontext (productie /articles/page/:ctx)
 * - all=1 (admin): alle artikelen incl. concepten (productie /articles/admin/all)
 */
export async function GET(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const sp = req.nextUrl.searchParams;
  const language = sp.get("lang") || "en";
  const role = helpRoleFor(user);

  try {
    if (sp.get("all") === "1") {
      const adminCheck = await learningAuthMiddleware(
        req,
        LEARNING_ROLE.LEARNING_ADMIN,
      );
      if (adminCheck) return adminCheck;
      return NextResponse.json({
        data: await learningHelpService.getAllArticlesForAdmin(),
      });
    }
    const q = sp.get("q");
    if (q) {
      return NextResponse.json({
        data: await learningHelpService.searchArticles(q, role, language),
      });
    }
    const page = sp.get("page");
    if (page) {
      return NextResponse.json({
        data: await learningHelpService.getArticlesByPage(page, role, language),
      });
    }
    return NextResponse.json({
      data: await learningHelpService.getArticles(role, language),
    });
  } catch (error) {
    console.error("[learning/help/articles] GET failed:", error);
    return NextResponse.json({ message: "help_failed" }, { status: 500 });
  }
}

/** POST — artikel aanmaken (admin). */
export async function POST(req: NextRequest) {
  // Platform-brede content (geen company_id) → beheer alleen door superadmin.
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  if (!body.title?.trim() || !body.content?.trim()) {
    return NextResponse.json({ message: "invalid" }, { status: 400 });
  }
  try {
    const article = await learningHelpService.createArticle(body, user.id);
    return NextResponse.json({ data: article }, { status: 201 });
  } catch (error) {
    console.error("[learning/help/articles] POST failed:", error);
    return NextResponse.json({ message: "help_failed" }, { status: 500 });
  }
}
