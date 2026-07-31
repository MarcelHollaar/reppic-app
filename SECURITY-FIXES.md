# Security fixes — Reppic (app + dashboard-backend + desktop-shell)

Applied 2026-07-20 after a full security review. This documents what was changed
in code and the **operational actions still required from the developer** (secret
rotation, one env var, and two breaking dependency upgrades).

`app` = Next.js app · `backend` = dashboard-backend · `desktop` = Electron shell.

---

## ⚠️ Operational actions still required (not code)

1. **Rotate all secrets** if `app/.env` was ever shipped in a handoff zip.
   Treat these as compromised and regenerate: `JWT_SECRET` (must match in app +
   backend), `DATABASE_URL` password, `OPENAI_API_KEY`, `LITELLM_API_KEY`,
   `ASSEMBLYAI_API_KEY`, `RECALL_API_KEY`, `RECALL_WEBHOOK_SECRET`, FTP + SMTP
   credentials, `LIVEAVATAR_API_KEY`. `.env` is git-ignored in all three folders;
   **never include it in a distribution zip** — ship only `.env.example`.
2. ~~**Set `ASSEMBLYAI_WEBHOOK_SECRET`** in the app env.~~ **VERVALLEN — zie
   ROLLBACK 2026-07-22 onderaan.** Deze variabele is voor de *app* niet meer
   nodig en mag uit `app/.env`. (De gelijknamige variabele in
   `dashboard-backend/.env` hoort bij een ánder endpoint en blijft wél gelden.)
3. **Two breaking dependency upgrades** (left out of the automatic fix because they
   need testing):
   - backend `jspdf` → latest (critical: LFI/path-traversal + JS execution). Used
     for client-side PDF export; verify report export after upgrade.
   - backend `drizzle-orm` → ≥0.45.2 (SQL-injection via unescaped identifiers).
     **Verified NOT exploitable in current code** (no dynamic identifiers come
     from user input), but upgrading is recommended. Test queries after.
   - app: a few remaining `high` advisories (`xlsx` has no fix — consider
     replacing with `exceljs`; `nodemailer`, `next` image-optimizer, `react-router`
     need review). Run `npm audit` for the current list.

---

## Fixed in code

### Critical
- **K2 — FTP path traversal / arbitrary web-root write** [app]. `saveAudioChunkToFtp`
  / `saveFileToFtp` and the read/list/delete helpers now sanitize every
  user-influenced path segment and filename (`sanitizePathSegment` /
  `sanitizeStoredFileName` in `utils/fileStorage.ts`); `download`/`delete` reject
  `..`/NUL. An uploaded `audio.name`/`conversationId` can no longer escape the
  recordings folder.
- **K4 — privilege escalation to superadmin** [app]. `createUser` no longer honors
  `admin_invite`/`role` from the request body unless the *caller* is a real
  superadmin; non-superadmins are constrained to `user`/`manager` in their own
  company. New `canActOnCompany` / `canManageTargetUser` guards in `helpers/userHelper.ts`.
- **K1 / K3** — see operational actions above (`.env` handling + dependency audit;
  app went 3 critical → 0 critical via non-breaking `npm audit fix`).

### High
- **H1 — IDOR cluster** [app]. Ownership/tenant checks added: company GET/PUT and
  company-users (contact-manager can only touch its own company), user delete
  (manager only within own company, never a superadmin target), and profile-read
  (self / same-company manager / superadmin only).
- **H2 — AssemblyAI webhook** [app]. ⚠️ **TERUGGEDRAAID op 2026-07-22 — deze fix
  is NIET meer actief.** Was: gedeelde secret in een custom header (fail-closed),
  eigenaar afgeleid uit het opgeslagen gesprek, en idempotent. Die drie poorten
  konden de transcriptie-callback stil afwijzen waardoor de analyse nooit startte;
  op verzoek van de opdrachtgever is het endpoint teruggezet naar het eerdere,
  werkende gedrag. **`/api/webhooks/assemblyai` in de app is nu onge-authenticeerd.**
  Zie het ROLLBACK-blok onderaan dit document.
- **H3 — auth rate limiting + OTP hardening** [app]. New in-memory `rateLimit` on
  `/api/auth` (per-IP + per-action/identity); OTPs raised from 4 to 6 digits.
- **H4 — desktop shell** [desktop]. Navigation allow-listed to the Reppic origin
  (`will-navigate` / `will-redirect` / `setWindowOpenHandler`); token inject/read
  gated on the current origin; `sandbox: true`; token file written `0600`.
- **H5 — recordings** [app]. The audio-stream endpoint now returns a short-lived,
  HMAC-signed URL to an authenticated byte proxy (`/api/audio-stream/file`, with
  range support) instead of a permanent public FTP URL.

### Medium
- Legacy Recall bot webhook now verifies the Svix signature (fail-closed) [app].
- Desktop test-bypass additionally gated on `NODE_ENV !== "production"` [app].
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  HSTS, a limited CSP) on all responses; CORS no longer pairs `*` with credentials
  — set `CORS_ALLOW_ORIGIN` for a specific credentialed origin [app].
- `developments/playback` embed HTML sanitized (`sanitizeEmbedHtml`) [app].
- Prompt-injection guard: transcript/plan treated as untrusted data in the
  analysis prompts [backend].
- Backend global error handler no longer leaks raw exception text on 5xx [backend].
- Rate limiting on the document/AI extract + structure endpoints (decompression /
  cost DoS) [app + backend].

### Low
- JWT verification pins `HS256` everywhere in the app; dead `utils/jwt.ts` removed.
- `CRON_SECRET` compared in constant time.
- Login OTP is never logged in production.
- Weak sample secrets in every `.env.example` blanked with a generate hint.

### Known residuals (accepted / need product input)
- **JWT in `localStorage`** (not httpOnly cookie): mitigated by CSP + sanitized
  HTML sinks; a cookie-based session is a larger refactor.
- **User enumeration** (login/forgot return different responses for unknown email):
  left as-is because changing the responses affects the login UX.

## Verification
`next build` (app) green; `tsc` (backend, server/shared) clean; `node --check`
(desktop) OK. Backend plan endpoints re-tested end-to-end earlier in the session.

---

## ROLLBACK 2026-07-22 — H2 (AssemblyAI-webhook app) teruggedraaid

**Waarom:** na deployment naar de testomgeving startte de analyse niet. De
transcriptie werd wél gemaakt, maar er kwam geen enkele LLM-call — ook geen
foutmelding. Oorzaak: de fail-closed authenticatie op
`/api/webhooks/assemblyai` weigerde de callback (HTTP 503 zolang
`ASSEMBLYAI_WEBHOOK_SECRET` niet gezet was). Op verzoek van de opdrachtgever is
teruggekeerd naar het eerdere, bewezen werkende gedrag.

**Wat is verwijderd** (app, `webhooks/assemblyai/route.ts`):
- gedeelde-secret-controle (503 als niet gezet, 401 bij mismatch)
- eigenaars-lookup tegen het opgeslagen gesprek (404)
- idempotentie-check op reeds voltooide transcripts

**Wat is verwijderd** (app, `services/assemblyAIService.ts`):
- het meesturen van `webhook_auth_header_name` / `-value` bij het indienen

De webhook-code is geverifieerd regel-voor-regel gelijk aan de laatste versie
waarin de keten werkte (alleen commentaar verschilt).

**Resterend risico — bewust geaccepteerd:**
`/api/webhooks/assemblyai` in de app is **niet geauthenticeerd**. Wie de URL
kent kan een callback nabootsen en daarmee een analyse laten draaien op zelf
aangeleverde tekst (LLM-kosten + vervuilde dashboards). Er is geen controle meer
dat de opgegeven `userId` de eigenaar van het gesprek is. Dit was ook de situatie
vóór de security-ronde van 2026-07-20.

**Niet geraakt door deze rollback:** alle overige fixes (K2, K4, H1, H3, H4, H5,
medium/low) blijven actief. Ook de gelijknamige `ASSEMBLYAI_WEBHOOK_SECRET` in
`dashboard-backend/.env` blijft gelden — die hoort bij het aparte
auto-import-endpoint van de backend, dat wél fail-closed is.

**Wil je H2 later herstellen:** zet de secret **vóórdat** er wordt opgenomen (de
waarde gaat bij het *indienen* mee naar AssemblyAI), herstart de app, en test met
een **nieuwe** opname. Opnames van daarvóór hebben geen header opgeslagen en
blijven anders afgewezen.
