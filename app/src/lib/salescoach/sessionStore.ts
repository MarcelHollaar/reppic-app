type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type Session = {
  id: string;
  language: string;
  phase: string;
  customerProfile?: string | null;
  model?: string | null;
  startedAt: number;
  endedAt?: number | null;
  history: ChatMessage[];
};

type GlobalSessionStore = {
  salesCoachSessions?: Map<string, Session>;
  salesCoachCleanupTimers?: Map<string, NodeJS.Timeout>;
};

const globalStore = globalThis as typeof globalThis & GlobalSessionStore;

const sessions = globalStore.salesCoachSessions ?? new Map<string, Session>();
const cleanupTimers =
  globalStore.salesCoachCleanupTimers ?? new Map<string, NodeJS.Timeout>();

globalStore.salesCoachSessions = sessions;
globalStore.salesCoachCleanupTimers = cleanupTimers;

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createSession(
  language: string,
  model: string | null,
  phase: string,
  customerProfile?: string | null
) {
  const id = randomId();
  const session: Session = {
    id,
    language,
    phase,
    customerProfile: customerProfile || null,
    model: model || null,
    startedAt: Date.now(),
    endedAt: null,
    history: [],
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function endSession(id: string) {
  const session = sessions.get(id);
  if (!session) return;
  session.endedAt = Date.now();
  const existingTimer = cleanupTimers.get(id);
  if (existingTimer) clearTimeout(existingTimer);
  const timer = setTimeout(() => {
    sessions.delete(id);
    cleanupTimers.delete(id);
  }, 15 * 60 * 1000); // keep transcripts for 15 minutes
  cleanupTimers.set(id, timer);
}

export function pushMessage(sessionId: string, msg: ChatMessage) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.history.push(msg);
}

export function getHistory(sessionId: string): ChatMessage[] {
  const session = sessions.get(sessionId);
  return session ? session.history : [];
}

export function clearSessionHistory(sessionId: string) {
  const session = sessions.get(sessionId);
  if (session) {
    session.history = [];
  }
}
