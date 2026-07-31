import { 
  type User, 
  type InsertUser,
  type Company,
  type InsertCompany,
  type Transcript,
  type InsertTranscript,
  type StrategyDocument,
  type InsertStrategyDocument,
  type PlanDocument,
  type InsertPlanDocument,
  type PlanType,
  type AnalyticsSnapshot,
  type DashboardType,
  users,
  companies,
  transcripts,
  strategyDocuments,
  planDocuments,
  analyticsSnapshots,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, isNull, or } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;

  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  getAllCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;

  // Transcripts (companyId = undefined means "all" for superadmin)
  createTranscript(transcript: InsertTranscript): Promise<Transcript>;
  getTranscript(id: string): Promise<Transcript | undefined>;
  getAllTranscripts(companyId?: string | null): Promise<Transcript[]>;
  updateTranscript(id: string, updates: Partial<Transcript>): Promise<Transcript | undefined>;
  deleteTranscript(id: string): Promise<boolean>;

  // Strategy documents
  createStrategyDocument(doc: InsertStrategyDocument): Promise<StrategyDocument>;
  getStrategyDocument(id: string): Promise<StrategyDocument | undefined>;
  getAllStrategyDocuments(companyId?: string | null): Promise<StrategyDocument[]>;
  deleteStrategyDocument(id: string): Promise<boolean>;

  // Plan documents (strategic and operational)
  createOrReplacePlan(plan: InsertPlanDocument): Promise<PlanDocument>;
  getPlan(planType: PlanType, language: string, companyId?: string | null): Promise<PlanDocument | undefined>;
  getAllPlans(companyId?: string | null): Promise<PlanDocument[]>;
  deletePlan(planType: PlanType, language: string, companyId?: string | null): Promise<boolean>;
  updatePlanStructure(planId: string, structured: unknown, status: 'proposed' | 'confirmed'): Promise<PlanDocument | undefined>;

  // Analytics snapshots
  getOrCreateSnapshot(weekNumber: string, dashboardType: DashboardType, language: string, companyId?: string | null): Promise<AnalyticsSnapshot>;
  updateSnapshot(id: string, data: string, transcriptCount: number): Promise<AnalyticsSnapshot | undefined>;
  getSnapshot(weekNumber: string, dashboardType: DashboardType, language: string, companyId?: string | null): Promise<AnalyticsSnapshot | undefined>;
  getAllSnapshots(dashboardType: DashboardType, language: string, companyId?: string | null): Promise<AnalyticsSnapshot[]>;
  getLatestSnapshot(dashboardType: DashboardType, language: string, companyId?: string | null): Promise<AnalyticsSnapshot | undefined>;
  deleteSnapshotsForLanguage(language: string, companyId?: string | null): Promise<void>;
  deleteSnapshotsByType(dashboardType: DashboardType, companyId?: string | null): Promise<number>;

  // Brandkit settings
  getBrandkitLogo(): Promise<string | null>;
  setBrandkitLogo(logoUrl: string | null): Promise<void>;

  // Password reset tokens
  createPasswordResetToken(email: string): Promise<{ code: string; userId: string } | null>;
  verifyAndConsumePasswordResetToken(code: string): Promise<{ userId: string } | null>;
}

// Helper: build a where condition that filters by companyId.
// If companyId is a non-empty string, filter to exactly that company.
// If companyId is undefined/null (superadmin), return all rows (no filter).
function companyFilter(companyId: string | null | undefined, col: any) {
  if (companyId == null) return undefined; // superadmin sees all
  return eq(col, companyId);
}

export class DatabaseStorage implements IStorage {
  private passwordResetTokens: Map<string, { userId: string; expiresAt: Date; used: boolean }> = new Map();

  constructor() {
    this._seedSuperAdmin();
  }

  private async _seedSuperAdmin() {
    try {
      const existing = await this.getUserByEmail("superadmin@reppic.ai");
      if (existing) return;
      // SECURITY: never seed a superadmin with a hard-coded/known password.
      // Only bootstrap when an explicit password is supplied via env, otherwise
      // skip — so there is no default-credential backdoor.
      const seedPassword = process.env.SUPERADMIN_SEED_PASSWORD;
      if (!seedPassword || seedPassword.trim().length < 8) {
        console.warn(
          "[seed] SUPERADMIN_SEED_PASSWORD not set (or too short) — skipping superadmin seed. " +
            "Set it once to bootstrap superadmin@reppic.ai, then unset it; or create the admin manually.",
        );
        return;
      }
      const hashedPassword = await bcrypt.hash(seedPassword, 10);
      await db.insert(users).values({
        id: "superadmin-seed-id",
        username: "superadmin",
        password: hashedPassword,
        email: "superadmin@reppic.ai",
        phone: null,
        mobile: null,
        companyId: null,
        role: "superadmin",
        twoFactorSecret: null,
        twoFactorEnabled: false,
      });
    } catch {
      // Already seeded or DB not ready — silently ignore
    }
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.username, username));
    return rows[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const rows = await db.insert(users).values({
      username: insertUser.username,
      password: insertUser.password,
      email: insertUser.email,
      phone: insertUser.phone ?? null,
      mobile: insertUser.mobile ?? null,
      companyId: insertUser.companyId ?? null,
      role: insertUser.role ?? 'user',
      twoFactorSecret: null,
      twoFactorEnabled: false,
    }).returning();
    return rows[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const rows = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return rows[0];
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async deleteUser(id: string): Promise<boolean> {
    const rows = await db.delete(users).where(eq(users.id, id)).returning();
    return rows.length > 0;
  }

  // ── Companies ──────────────────────────────────────────────────────────────

  async getCompany(id: string): Promise<Company | undefined> {
    const rows = await db.select().from(companies).where(eq(companies.id, id));
    return rows[0];
  }

  async getAllCompanies(): Promise<Company[]> {
    return db.select().from(companies);
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const rows = await db.insert(companies).values({ name: insertCompany.name }).returning();
    return rows[0];
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const rows = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return rows[0];
  }

  async deleteCompany(id: string): Promise<boolean> {
    const rows = await db.delete(companies).where(eq(companies.id, id)).returning();
    return rows.length > 0;
  }

  // ── Transcripts ────────────────────────────────────────────────────────────

  async createTranscript(insertTranscript: InsertTranscript): Promise<Transcript> {
    const rows = await db.insert(transcripts).values({
      filename: insertTranscript.filename,
      content: insertTranscript.content,
      status: insertTranscript.status ?? 'pending',
      analysis: insertTranscript.analysis ?? null,
      language: insertTranscript.language ?? 'nl',
      companyId: insertTranscript.companyId ?? null,
      userId: insertTranscript.userId ?? null,
      userName: insertTranscript.userName ?? null,
      coachingAnalysis: (insertTranscript as any).coachingAnalysis ?? null,
    }).returning();
    return rows[0];
  }

  async getTranscript(id: string): Promise<Transcript | undefined> {
    const rows = await db.select().from(transcripts).where(eq(transcripts.id, id));
    return rows[0];
  }

  async getAllTranscripts(companyId?: string | null): Promise<Transcript[]> {
    if (companyId != null) {
      return db.select().from(transcripts)
        .where(eq(transcripts.companyId, companyId))
        .orderBy(desc(transcripts.uploadedAt));
    }
    return db.select().from(transcripts).orderBy(desc(transcripts.uploadedAt));
  }

  async updateTranscript(id: string, updates: Partial<Transcript>): Promise<Transcript | undefined> {
    const rows = await db.update(transcripts).set(updates).where(eq(transcripts.id, id)).returning();
    return rows[0];
  }

  async deleteTranscript(id: string): Promise<boolean> {
    const rows = await db.delete(transcripts).where(eq(transcripts.id, id)).returning();
    return rows.length > 0;
  }

  // ── Strategy Documents ─────────────────────────────────────────────────────

  async createStrategyDocument(insertDoc: InsertStrategyDocument): Promise<StrategyDocument> {
    const rows = await db.insert(strategyDocuments).values({
      filename: insertDoc.filename,
      content: insertDoc.content,
      companyId: insertDoc.companyId ?? null,
    }).returning();
    return rows[0];
  }

  async getStrategyDocument(id: string): Promise<StrategyDocument | undefined> {
    const rows = await db.select().from(strategyDocuments).where(eq(strategyDocuments.id, id));
    return rows[0];
  }

  async getAllStrategyDocuments(companyId?: string | null): Promise<StrategyDocument[]> {
    if (companyId != null) {
      return db.select().from(strategyDocuments)
        .where(eq(strategyDocuments.companyId, companyId))
        .orderBy(desc(strategyDocuments.uploadedAt));
    }
    return db.select().from(strategyDocuments).orderBy(desc(strategyDocuments.uploadedAt));
  }

  async deleteStrategyDocument(id: string): Promise<boolean> {
    const rows = await db.delete(strategyDocuments).where(eq(strategyDocuments.id, id)).returning();
    return rows.length > 0;
  }

  // ── Plan Documents ─────────────────────────────────────────────────────────

  async createOrReplacePlan(insertPlan: InsertPlanDocument): Promise<PlanDocument> {
    const cId = insertPlan.companyId ?? null;
    const lang = insertPlan.language ?? 'nl';

    // Delete existing plan for same type + language + company
    if (cId != null) {
      await db.delete(planDocuments).where(
        and(
          eq(planDocuments.planType, insertPlan.planType),
          eq(planDocuments.language, lang),
          eq(planDocuments.companyId, cId)
        )
      );
    } else {
      // superadmin: delete global plan (null companyId)
      await db.delete(planDocuments).where(
        and(
          eq(planDocuments.planType, insertPlan.planType),
          eq(planDocuments.language, lang),
          isNull(planDocuments.companyId)
        )
      );
    }

    const rows = await db.insert(planDocuments).values({
      filename: insertPlan.filename,
      content: insertPlan.content,
      planType: insertPlan.planType,
      language: lang,
      companyId: cId,
    }).returning();
    return rows[0];
  }

  async getPlan(planType: PlanType, language: string, companyId?: string | null): Promise<PlanDocument | undefined> {
    if (companyId != null) {
      // First try company-specific plan, fall back to global plan (null companyId)
      const rows = await db.select().from(planDocuments).where(
        and(
          eq(planDocuments.planType, planType),
          eq(planDocuments.language, language),
          eq(planDocuments.companyId, companyId)
        )
      );
      if (rows[0]) return rows[0];
      // Fall back to global plan
      const global = await db.select().from(planDocuments).where(
        and(
          eq(planDocuments.planType, planType),
          eq(planDocuments.language, language),
          isNull(planDocuments.companyId)
        )
      );
      return global[0];
    }
    // Superadmin: return global plan (null companyId)
    const rows = await db.select().from(planDocuments).where(
      and(
        eq(planDocuments.planType, planType),
        eq(planDocuments.language, language),
        isNull(planDocuments.companyId)
      )
    );
    return rows[0];
  }

  async getAllPlans(companyId?: string | null): Promise<PlanDocument[]> {
    if (companyId != null) {
      return db.select().from(planDocuments).where(
        or(
          eq(planDocuments.companyId, companyId),
          isNull(planDocuments.companyId)
        )
      ).orderBy(desc(planDocuments.uploadedAt));
    }
    return db.select().from(planDocuments).orderBy(desc(planDocuments.uploadedAt));
  }

  async deletePlan(planType: PlanType, language: string, companyId?: string | null): Promise<boolean> {
    if (companyId != null) {
      const rows = await db.delete(planDocuments).where(
        and(
          eq(planDocuments.planType, planType),
          eq(planDocuments.language, language),
          eq(planDocuments.companyId, companyId)
        )
      ).returning();
      return rows.length > 0;
    }
    const rows = await db.delete(planDocuments).where(
      and(
        eq(planDocuments.planType, planType),
        eq(planDocuments.language, language),
        isNull(planDocuments.companyId)
      )
    ).returning();
    return rows.length > 0;
  }

  async updatePlanStructure(planId: string, structured: unknown, status: 'proposed' | 'confirmed'): Promise<PlanDocument | undefined> {
    const rows = await db.update(planDocuments)
      .set({
        structured: structured as any,
        structuredStatus: status,
        structuredUpdatedAt: new Date(),
      })
      .where(eq(planDocuments.id, planId))
      .returning();
    return rows[0];
  }

  // ── Analytics Snapshots ────────────────────────────────────────────────────

  async getOrCreateSnapshot(weekNumber: string, dashboardType: DashboardType, language: string, companyId?: string | null): Promise<AnalyticsSnapshot> {
    const existing = await this.getSnapshot(weekNumber, dashboardType, language, companyId);
    if (existing) return existing;

    const emptyData = dashboardType === 'strategic'
      ? JSON.stringify({
          trends: { newNeeds: [], knownNeeds: [], comparison: '' },
          customerSatisfaction: { sentiments: [], issues: [], comparison: '' },
          competition: { competitors: [], strengths: [], comparison: '' },
          proposition: { execution: [], resonance: [], comparison: '' }
        })
      : JSON.stringify({
          conversationActivity: { totalConversations: 0, avgDuration: 0, activityByDay: [], comparison: '' },
          picaPerformance: { phaseScores: [], phaseDetails: [], comparison: '' },
          dealHealth: { leadWarmth: [], dealStages: [], avgDealScore: 0, comparison: '' },
          teamInsights: { absolute: [], percentages: [], uspOverview: [], comparison: '' },
          resistanceNeeds: { topResistances: [], commercialTriggers: [], comparison: '' },
          nextStepDiscipline: { withClearNextStep: 0, nextStepTypes: [], avgNextStepClarity: 0, comparison: '' },
          uspMentions: { usps: [], comparison: '' }
        });

    const rows = await db.insert(analyticsSnapshots).values({
      weekNumber,
      dashboardType,
      language,
      data: emptyData,
      transcriptCount: '0',
      companyId: companyId ?? null,
    }).returning();
    return rows[0];
  }

  async updateSnapshot(id: string, data: string, transcriptCount: number): Promise<AnalyticsSnapshot | undefined> {
    const rows = await db.update(analyticsSnapshots)
      .set({ data, transcriptCount: String(transcriptCount), updatedAt: new Date() })
      .where(eq(analyticsSnapshots.id, id))
      .returning();
    return rows[0];
  }

  async getSnapshot(weekNumber: string, dashboardType: DashboardType, language: string, companyId?: string | null): Promise<AnalyticsSnapshot | undefined> {
    if (companyId != null) {
      const rows = await db.select().from(analyticsSnapshots).where(
        and(
          eq(analyticsSnapshots.weekNumber, weekNumber),
          eq(analyticsSnapshots.dashboardType, dashboardType),
          eq(analyticsSnapshots.language, language),
          eq(analyticsSnapshots.companyId, companyId)
        )
      );
      return rows[0];
    }
    const rows = await db.select().from(analyticsSnapshots).where(
      and(
        eq(analyticsSnapshots.weekNumber, weekNumber),
        eq(analyticsSnapshots.dashboardType, dashboardType),
        eq(analyticsSnapshots.language, language),
        isNull(analyticsSnapshots.companyId)
      )
    );
    return rows[0];
  }

  async getAllSnapshots(dashboardType: DashboardType, language: string, companyId?: string | null): Promise<AnalyticsSnapshot[]> {
    if (companyId != null) {
      return db.select().from(analyticsSnapshots).where(
        and(
          eq(analyticsSnapshots.dashboardType, dashboardType),
          eq(analyticsSnapshots.language, language),
          eq(analyticsSnapshots.companyId, companyId)
        )
      ).orderBy(desc(analyticsSnapshots.weekNumber));
    }
    return db.select().from(analyticsSnapshots).where(
      and(
        eq(analyticsSnapshots.dashboardType, dashboardType),
        eq(analyticsSnapshots.language, language)
      )
    ).orderBy(desc(analyticsSnapshots.weekNumber));
  }

  async getLatestSnapshot(dashboardType: DashboardType, language: string, companyId?: string | null): Promise<AnalyticsSnapshot | undefined> {
    const rows = await this.getAllSnapshots(dashboardType, language, companyId);
    return rows[0];
  }

  async deleteSnapshotsForLanguage(language: string, companyId?: string | null): Promise<void> {
    if (companyId != null) {
      await db.delete(analyticsSnapshots).where(
        and(
          eq(analyticsSnapshots.language, language),
          eq(analyticsSnapshots.companyId, companyId)
        )
      );
    } else {
      await db.delete(analyticsSnapshots).where(eq(analyticsSnapshots.language, language));
    }
  }

  async deleteSnapshotsByType(dashboardType: DashboardType, companyId?: string | null): Promise<number> {
    let result;
    if (companyId != null) {
      result = await db.delete(analyticsSnapshots).where(
        and(
          eq(analyticsSnapshots.dashboardType, dashboardType),
          eq(analyticsSnapshots.companyId, companyId)
        )
      );
    } else {
      result = await db.delete(analyticsSnapshots).where(
        eq(analyticsSnapshots.dashboardType, dashboardType)
      );
    }
    return (result as any).rowCount ?? 0;
  }

  // ── Brandkit ───────────────────────────────────────────────────────────────

  async getBrandkitLogo(): Promise<string | null> {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`SELECT logo_url FROM brandkit_settings WHERE id = 1`;
      return rows[0]?.logo_url ?? null;
    } catch {
      return null;
    }
  }

  async setBrandkitLogo(logoUrl: string | null): Promise<void> {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO brandkit_settings (id, logo_url) VALUES (1, ${logoUrl})
      ON CONFLICT (id) DO UPDATE SET logo_url = ${logoUrl}
    `;
  }

  // ── Password Reset Tokens (in-memory — short-lived, 15 min) ───────────────

  async createPasswordResetToken(email: string): Promise<{ code: string; userId: string } | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;

    const { randomInt } = await import("crypto");
    const code = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    for (const [k, v] of Array.from(this.passwordResetTokens.entries())) {
      if (v.userId === user.id) this.passwordResetTokens.delete(k);
    }

    this.passwordResetTokens.set(code, { userId: user.id, expiresAt, used: false });
    return { code, userId: user.id };
  }

  async verifyAndConsumePasswordResetToken(code: string): Promise<{ userId: string } | null> {
    const token = this.passwordResetTokens.get(code);
    if (!token) return null;
    if (token.used) return null;
    if (token.expiresAt < new Date()) {
      this.passwordResetTokens.delete(code);
      return null;
    }
    token.used = true;
    return { userId: token.userId };
  }
}

export const storage = new DatabaseStorage();
