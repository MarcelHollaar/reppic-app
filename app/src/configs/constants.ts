import { enUS, fr, de, es, nl, type Locale  } from "date-fns/locale";
export const LOGIN_OTP_TTL_MS = 10 * 60 * 1000;
export const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const AUDIO_RETENTION_DAYS = 7;
export const AUDIO_RETENTION_MS = AUDIO_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const RECORDING_CLEANUP_BATCH_SIZE = 50;

export enum USER_ROLE {
  SUPER_ADMIN = "superadmin",
  MANAGER = "manager",
  USER = "user",
}

// Leer-as (LMS-integratie), onafhankelijk van USER_ROLE.
// Platform-superadmin is impliciet ook leer-superadmin.
export enum LEARNING_ROLE {
  NONE = "none",
  LEARNER = "learner",
  LEARNING_ADMIN = "learning_admin",
}
export enum TWIN_AI_STATUS {
  IN_PROCESS = 'in_process',
  COMPLETED = 'completed',
  FAILED = 'failed',
  NOT_INITIATED = 'not_initiated'
}
export enum NOTIFICATION_TYPE {
  CONVERSATION = 'conversation',
}

export enum NOTIFICATION_REFERENCE_TYPE {
  CONVERSATIONS = 'conversations',
}

export const TEAM_STATS = "TEAM_STATS";
export const USER_STATS = "USER_STATS";
export enum STATUS {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export const localeMap: Record<string, Locale> = {
  en: enUS,
  fr,
  de,
  es,
  nl,
};

export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "nl", label: "Dutch" },
  { code: "de", label: "German" },
  {code: "it", label: "Italian" }
];

export const FAILED_UPLOAD_STATUS = [
  'twinAI_upload_failed',
  'file_upload_failed'
]

export const PLATFORM_SETTING_KEYS = {
  ANALYSIS_LITELLM_MODEL: "analysis_litellm_model",
  // LMS-analyses, elk koppelbaar aan een eigen LiteLLM-model:
  LMS_PATHGEN_LITELLM_MODEL: "lms_pathgen_litellm_model", // AI-leerpadgeneratie (chat)
  LMS_TRANSLATION_LITELLM_MODEL: "lms_translation_litellm_model", // module-vertalingen (chat)
  LMS_MODULEGEN_LITELLM_MODEL: "lms_modulegen_litellm_model", // AI-modulegeneratie (chat)
  LMS_EMBEDDINGS_MODEL: "lms_embeddings_model", // kennisbibliotheek (embeddings)
} as const;

export enum CONVERSATION_STATUS {
  COMPLETED_TWIN_AI_PROCESS = 'completed_twin_ai_process',
  TWIN_AI_UPLOAD_SUCCESS = 'twinAI_upload_success',
  CONVERSATION_PAUSED = 'conversation_paused',
  FILE_UPLOAD_SUCCESS = 'file_upload_success',
  FILE_UPLOAD_FAILED = 'file_upload_failed',
  TWIN_AI_UPLOAD_FAILED = 'twinAI_upload_failed',
  DRAFT = 'draft'
}