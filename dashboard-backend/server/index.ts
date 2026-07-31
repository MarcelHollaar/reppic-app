import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { log } from "./vite";

const app = express();

// Behind a reverse proxy (production) trust X-Forwarded-* so secure cookies work.
app.set("trust proxy", 1);

// CORS: only allow the configured Reppic origin(s) — never reflect arbitrary
// origins while credentials are enabled. Comma-separated list supported.
const allowedOrigins = (process.env.REPPIC_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin/non-browser requests (no Origin header, e.g. server-to-server pushes)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);

// Plan/transcript uploads send PDFs as base64 JSON (~33% larger than the file).
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "25mb";
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: jsonBodyLimit }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Log the detail server-side; never leak raw exception text (DB errors,
    // stack, internal paths) to the client. Client-facing 4xx messages set
    // explicitly by handlers still pass through; unexpected 5xx get a generic
    // message.
    console.error("[unhandled error]", err?.stack || err?.message || err);
    const message =
      status >= 500 ? "Internal Server Error" : err.message || "Request failed";

    res.status(status).json({ message });
  });

  // Client UI is optional: Reppic embeds dashboards; Docker builds API-only (build:api).
  const clientDistPath = path.resolve(import.meta.dirname, "public");
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else if (fs.existsSync(clientDistPath)) {
    const { serveStatic } = await import("./vite");
    serveStatic(app);
  } else {
    log("API-only mode: dashboard client not bundled");
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });
})();
