import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  defaultLanguage: text("default_language"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
}).extend({
  defaultLanguage: z.enum(['nl', 'en', 'de', 'fr', 'es', 'it']).nullable().optional(),
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export const userRoleEnum = z.enum(['superadmin', 'admin', 'user']);
export type UserRole = z.infer<typeof userRoleEnum>;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  mobile: text("mobile"),
  companyId: varchar("company_id"),
  role: text("role").notNull().default('user'),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  twoFactorSecret: true,
  twoFactorEnabled: true,
}).extend({
  role: userRoleEnum.default('user'),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const transcripts = pgTable("transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
  status: text("status").notNull().default('pending'),
  analysis: text("analysis"),
  language: text("language").notNull().default('nl'),
  companyId: varchar("company_id"),
  // Salesperson this conversation belongs to (from the Reppic JWT). Enables
  // per-salesperson PICA aggregation for the individual dashboard, using the
  // exact same per-transcript operational analysis that feeds the team view.
  userId: varchar("user_id"),
  userName: text("user_name"),
  // Single-source-of-truth coaching analysis produced by the Reppic app (PICA
  // phaseScores/phaseDetails, resistances, …). When present it is used for the
  // operational dashboard instead of the backend's own per-transcript analysis,
  // so the operational and personal (salesperson) dashboards always agree.
  coachingAnalysis: jsonb("coaching_analysis"),
});

export const insertTranscriptSchema = createInsertSchema(transcripts).omit({
  id: true,
  uploadedAt: true,
}).extend({
  language: z.enum(['nl', 'en', 'de', 'fr', 'es', 'it']).default('nl'),
  companyId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  userName: z.string().nullable().optional(),
  coachingAnalysis: z.any().nullable().optional(),
});

export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type Transcript = typeof transcripts.$inferSelect;

export const strategyDocuments = pgTable("strategy_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
  companyId: varchar("company_id"),
});

export const insertStrategyDocumentSchema = createInsertSchema(strategyDocuments).omit({
  id: true,
  uploadedAt: true,
}).extend({
  companyId: z.string().nullable().optional(),
});

export type InsertStrategyDocument = z.infer<typeof insertStrategyDocumentSchema>;
export type StrategyDocument = typeof strategyDocuments.$inferSelect;

// Plan documents for strategic and operational dashboards
export const planDocuments = pgTable("plan_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  planType: text("plan_type").notNull(), // 'strategic' or 'operational'
  language: text("language").notNull().default('nl'),
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
  companyId: varchar("company_id"),
  // Canonical structured version of the plan (AI-proposed, manager-reviewed).
  // 'none' = raw text only (legacy behavior), 'proposed' = AI suggestion not
  // yet reviewed, 'confirmed' = manager approved → used in analysis prompts.
  structured: jsonb("structured"),
  structuredStatus: text("structured_status").notNull().default('none'),
  structuredUpdatedAt: timestamp("structured_updated_at"),
});

export const planTypeEnum = z.enum(['strategic', 'operational']);
export type PlanType = z.infer<typeof planTypeEnum>;

export const insertPlanDocumentSchema = createInsertSchema(planDocuments).omit({
  id: true,
  uploadedAt: true,
  structured: true,
  structuredStatus: true,
  structuredUpdatedAt: true,
}).extend({
  planType: planTypeEnum,
  language: z.enum(['nl', 'en', 'de', 'fr', 'es', 'it']).default('nl'),
  companyId: z.string().nullable().optional(),
});

export type InsertPlanDocument = z.infer<typeof insertPlanDocumentSchema>;
export type PlanDocument = typeof planDocuments.$inferSelect;

// ── Canonical structured plan (format-independent) ──────────────────────────
// A company plan in any layout is normalized into this shape once at upload
// time; analyses then compare against this instead of re-interpreting the raw
// document per transcript. All fields optional — a sparse plan is valid.

export const planKpiSchema = z.object({
  name: z.string(),
  target: z.string().optional().default(""),
  unit: z.string().optional().default(""),
  period: z.string().optional().default(""),
});

export const strategicStructuredPlanSchema = z.object({
  objectives: z.array(z.object({
    title: z.string(),
    description: z.string().optional().default(""),
    kpis: z.array(planKpiSchema).optional().default([]),
  })).optional().default([]),
  keyMessages: z.array(z.string()).optional().default([]),
  targetSegments: z.array(z.string()).optional().default([]),
  competitivePosition: z.string().optional().default(""),
  otherNotes: z.string().optional().default(""),
});

export const picaPhaseKeyEnum = z.enum(['proposition', 'inventory', 'conviction', 'closing']);

export const operationalStructuredPlanSchema = z.object({
  picaTargets: z.array(z.object({
    phaseKey: picaPhaseKeyEnum,
    focusPoints: z.array(z.string()).optional().default([]),
  })).optional().default([]),
  skillTargets: z.array(z.object({
    skill: z.string(),
    target: z.string().optional().default(""),
    description: z.string().optional().default(""),
  })).optional().default([]),
  benchmarks: z.array(z.object({
    metric: z.string(),
    target: z.string().optional().default(""),
    unit: z.string().optional().default(""),
  })).optional().default([]),
  focusAreas: z.array(z.string()).optional().default([]),
  otherNotes: z.string().optional().default(""),
});

export type StrategicStructuredPlan = z.infer<typeof strategicStructuredPlanSchema>;
export type OperationalStructuredPlan = z.infer<typeof operationalStructuredPlanSchema>;
export type StructuredPlan = StrategicStructuredPlan | OperationalStructuredPlan;

export function structuredPlanSchemaFor(planType: PlanType) {
  return planType === 'strategic' ? strategicStructuredPlanSchema : operationalStructuredPlanSchema;
}

// Analytics snapshots for cumulative weekly data storage
export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekNumber: text("week_number").notNull(), // Format: "2025-W01"
  dashboardType: text("dashboard_type").notNull(), // 'strategic' or 'operational'
  language: text("language").notNull().default('nl'),
  data: text("data").notNull(), // JSON stringified analytics data
  transcriptCount: text("transcript_count").notNull().default('0'), // Number of transcripts analyzed
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  companyId: varchar("company_id"),
});

// Key/value platform settings (e.g. the superadmin-chosen dashboard-analysis model).
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
export type PlatformSetting = typeof platformSettings.$inferSelect;

export const dashboardTypeEnum = z.enum(['strategic', 'operational']);
export type DashboardType = z.infer<typeof dashboardTypeEnum>;

export const insertAnalyticsSnapshotSchema = createInsertSchema(analyticsSnapshots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dashboardType: dashboardTypeEnum,
  language: z.enum(['nl', 'en', 'de', 'fr', 'es', 'it']).default('nl')
});

export type InsertAnalyticsSnapshot = z.infer<typeof insertAnalyticsSnapshotSchema>;
export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;

// Strategic analytics data structure
export const strategicAnalyticsSchema = z.object({
  trends: z.object({
    newNeeds: z.array(z.object({ name: z.string(), value: z.number(), description: z.string().optional() })),
    knownNeeds: z.array(z.object({ name: z.string(), value: z.number(), description: z.string().optional() })),
    comparison: z.string().optional()
  }),
  customerSatisfaction: z.object({
    sentiments: z.array(z.object({ name: z.string(), value: z.number(), type: z.string().optional() })),
    issues: z.array(z.object({ name: z.string(), value: z.number(), severity: z.string().optional() })),
    comparison: z.string().optional()
  }),
  competition: z.object({
    competitors: z.array(z.object({ name: z.string(), value: z.number(), mentions: z.number().optional() })),
    strengths: z.array(z.object({ name: z.string(), value: z.number() })),
    comparison: z.string().optional()
  }),
  proposition: z.object({
    recommendations: z.array(z.object({ name: z.string(), value: z.number(), priority: z.string().optional() })),
    improvements: z.array(z.object({ name: z.string(), value: z.number() })),
    comparison: z.string().optional()
  })
});

export type StrategicAnalytics = z.infer<typeof strategicAnalyticsSchema>;

// Operational analytics data structure
export const operationalAnalyticsSchema = z.object({
  conversationActivity: z.object({
    totalConversations: z.number(),
    avgDuration: z.number(),
    activityByDay: z.array(z.object({ name: z.string(), value: z.number() })),
    comparison: z.string().optional()
  }),
  picaPerformance: z.object({
    phaseScores: z.array(z.object({ name: z.string(), value: z.number() })),
    phaseDetails: z.array(z.object({
      phase: z.number(),
      metrics: z.array(z.object({ key: z.string(), value: z.number() }))
    })).optional(),
    comparison: z.string().optional()
  }),
  dealHealth: z.object({
    leadWarmth: z.array(z.object({ name: z.string(), value: z.number() })), // Hot, Warm, Cold
    dealStages: z.array(z.object({ name: z.string(), value: z.number() })),
    avgDealScore: z.number(),
    comparison: z.string().optional()
  }),
  teamInsights: z.object({
    skillsOverview: z.array(z.object({ name: z.string(), value: z.number() })),
    performanceMetrics: z.array(z.object({ name: z.string(), value: z.number() })),
    comparison: z.string().optional()
  }),
  resistanceNeeds: z.object({
    topResistances: z.array(z.object({ name: z.string(), value: z.number(), category: z.string().optional() })),
    commercialTriggers: z.array(z.object({ name: z.string(), value: z.number() })),
    comparison: z.string().optional()
  }),
  nextStepDiscipline: z.object({
    withClearNextStep: z.number(), // Percentage
    nextStepTypes: z.array(z.object({ name: z.string(), value: z.number() })),
    avgNextStepClarity: z.number(),
    comparison: z.string().optional()
  })
});

export type OperationalAnalytics = z.infer<typeof operationalAnalyticsSchema>;
