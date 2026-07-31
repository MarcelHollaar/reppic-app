/**
 * Reppic Desktop test-shell (main process).
 *
 * Productie-representatieve flow met EENMALIGE login:
 *
 *   1. Bij eerste start logt de gebruiker één keer in in het app-venster
 *      (het echte Reppic-loginscherm). De webapp bewaart het JWT in
 *      localStorage.token; wij lezen dat uit en bewaren het op schijf.
 *   2. Daarna volledig automatisch: SDK detecteert meeting → bevestig-pop-up
 *      "Opnemen?" → main haalt een upload-token bij de Reppic-backend MET het
 *      JWT van de ingelogde gebruiker (Authorization: Bearer) → startRecording.
 *   3. Na afloop uploadt de SDK naar Recall → Recall roept /api/webhooks/
 *      recall-sdk aan → de opname landt in het dashboard van EXACT die gebruiker.
 *
 * Het bewaarde token overleeft herstarts (bestand in userData), zodat de
 * gebruiker niet telkens opnieuw hoeft in te loggen. Verloopt het token, dan
 * vraagt de app om opnieuw in te loggen.
 */
const { app, BrowserWindow, dialog, ipcMain, screen } = require("electron");
const path = require("path");
const http = require("http");
const https = require("https");
const fs = require("fs");
const RecallAiSdk = require("@recallai/desktop-sdk");

const REPPIC_URL = process.env.REPPIC_URL || "http://localhost:3200";
const RECALL_API_URL =
  process.env.RECALL_API_URL || "https://us-west-2.recall.ai";
const TOKEN_ENDPOINT = `${REPPIC_URL}/api/recall/desktop-upload-token`;

const log = (...a) => console.log("[shell]", ...a);

// Only ever inject/read the login token on, and allow navigation to, the known
// Reppic origin. Prevents a redirect/compromise from handing the desktop JWT to
// an attacker origin (or planting one).
const REPPIC_ORIGIN = (() => {
  try {
    return new URL(REPPIC_URL).origin;
  } catch {
    return null;
  }
})();
function isReppicOrigin(urlStr) {
  try {
    return REPPIC_ORIGIN !== null && new URL(urlStr).origin === REPPIC_ORIGIN;
  } catch {
    return false;
  }
}

// ── Auth-token (JWT van de ingelogde gebruiker) ─────────────────────────────
let TOKEN_FILE = null; // pas na app.ready te bepalen (userData)
let authToken = null;

function loadStoredToken() {
  try {
    const raw = fs.readFileSync(TOKEN_FILE, "utf8");
    authToken = JSON.parse(raw).token || null;
  } catch {
    authToken = null;
  }
}
function persistToken(token) {
  authToken = token;
  try {
    // mode 0600: readable/writable by the owner only, never world-readable.
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token }), { encoding: "utf8", mode: 0o600 });
  } catch (e) {
    log("kon token niet bewaren:", e.message);
  }
}
function clearToken() {
  authToken = null;
  try {
    fs.unlinkSync(TOKEN_FILE);
  } catch {}
}
function tokenEmail() {
  // JWT payload uitlezen (alleen voor weergave; geen verificatie).
  try {
    const p = JSON.parse(
      Buffer.from(authToken.split(".")[1], "base64").toString("utf8")
    );
    return p.email || "onbekend";
  } catch {
    return "onbekend";
  }
}

// ── Opname-status ───────────────────────────────────────────────────────────
const recording = new Set();
const handledWindows = new Set();
let promptOpen = false;
let mainWindow = null;
let chipWindow = null;
let pendingMeetingWindow = null;

// ── Opname-chip ──────────────────────────────────────────────────────────────
// Recall's eigen voorbeeld toont de opnamevraag NIET als systeemdialoog (die
// steelt focus en duwt de meeting weg), maar als klein, frameless,
// always-on-top venster dat INACTIEF wordt getoond — zo blijft de meeting de
// actieve app en zweeft het chipje eroverheen, ook over een schermvullende
// meeting.
function createChipWindow() {
  chipWindow = new BrowserWindow({
    width: 320,
    height: 150,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    fullscreenable: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    // macOS: 'panel' geeft het venster de NSNonactivatingPanel-stijl waardoor
    // het BOVEN de fullscreen-modus van andere apps (Zoom/Meet/Teams) zweeft en
    // op alle Spaces verschijnt — precies waar een gewoon venster faalt.
    // Officiële Electron-docs (BaseWindow → type).
    ...(process.platform === "darwin" ? { type: "panel" } : {}),
    webPreferences: {
      preload: path.join(__dirname, "chip-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Boven normale vensters, en zichtbaar over een fullscreen-Space heen.
  chipWindow.setAlwaysOnTop(true, "screen-saver");
  chipWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  chipWindow.loadFile(path.join(__dirname, "chip.html"));
}

function positionChipTopRight() {
  if (!chipWindow || chipWindow.isDestroyed()) return;
  const { workArea } = screen.getPrimaryDisplay();
  const b = chipWindow.getBounds();
  chipWindow.setPosition(
    Math.round(workArea.x + workArea.width - b.width - 16),
    Math.round(workArea.y + 16)
  );
}

function showChip(meetingWindow) {
  pendingMeetingWindow = meetingWindow;
  if (!chipWindow || chipWindow.isDestroyed()) {
    // Zonder chip liever tóch opnemen dan de detectie verliezen.
    handledWindows.add(meetingWindow.id);
    void startRecordingFor(meetingWindow);
    return;
  }
  chipWindow.webContents.send("chip-data", { account: tokenEmail() });
  positionChipTopRight();
  // showInactive: tonen ZONDER de focus van de meeting af te pakken.
  chipWindow.showInactive();
}

function hideChip() {
  if (chipWindow && !chipWindow.isDestroyed() && chipWindow.isVisible()) {
    chipWindow.hide();
  }
}

// Keuze uit de chip: opnemen.
ipcMain.on("chip-record", () => {
  hideChip();
  promptOpen = false;
  const w = pendingMeetingWindow;
  pendingMeetingWindow = null;
  if (w) {
    handledWindows.add(w.id);
    void startRecordingFor(w);
  }
});

// Keuze uit de chip: niet nu.
ipcMain.on("chip-dismiss", () => {
  hideChip();
  promptOpen = false;
  const w = pendingMeetingWindow;
  pendingMeetingWindow = null;
  if (w) {
    handledWindows.add(w.id);
    log("gebruiker koos 'Niet nu' voor", w.id);
  }
});

function fetchUploadToken() {
  return new Promise((resolve, reject) => {
    if (!authToken) return reject(new Error("NIET_INGELOGD"));
    const u = new URL(TOKEN_ENDPOINT);
    // Protocol-aware: de shell wordt lokaal tegen http://localhost gedraaid,
    // maar tegen een test-/productieomgeving is REPPIC_URL https. Met alleen de
    // http-module mislukt TLS en valt de poort terug op 80.
    const client = u.protocol === "https:" ? https : http;
    const req = client.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode === 401 || res.statusCode === 403) {
            return reject(new Error("TOKEN_VERLOPEN"));
          }
          if (res.statusCode !== 200) {
            return reject(
              new Error(`token HTTP ${res.statusCode}: ${body.slice(0, 200)}`)
            );
          }
          try {
            const json = JSON.parse(body);
            if (!json.uploadToken)
              return reject(new Error("geen uploadToken in response"));
            resolve(json.uploadToken);
          } catch {
            reject(new Error("token-response geen JSON"));
          }
        });
      }
    );
    req.on("error", reject);
    req.end("{}");
  });
}

async function startRecordingFor(window) {
  const windowId = window.id;
  if (recording.has(windowId)) return;
  recording.add(windowId);
  try {
    log(`opnemen (${window.platform}) → upload-token ophalen…`);
    const uploadToken = await fetchUploadToken();
    log("upload-token ok → startRecording…");
    await RecallAiSdk.startRecording({ windowId, uploadToken });
    log("startRecording aangeroepen ✓");
  } catch (e) {
    recording.delete(windowId);
    if (e.message === "TOKEN_VERLOPEN" || e.message === "NIET_INGELOGD") {
      clearToken();
      log("sessie verlopen — gebruiker moet opnieuw inloggen");
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        dialog.showMessageBox(mainWindow, {
          type: "info",
          buttons: ["OK"],
          title: "Reppic",
          message: "Log opnieuw in",
          detail:
            "Je sessie is verlopen. Log opnieuw in in het Reppic-venster; daarna worden gesprekken weer automatisch opgenomen.",
        });
      }
    } else {
      log("FOUT bij starten opname:", e.message);
    }
  }
}

async function onMeetingDetected(window) {
  const id = window.id;
  if (promptOpen || recording.size > 0 || handledWindows.has(id)) return;

  // Zonder login kunnen we de opname niet aan een gebruiker koppelen.
  if (!authToken) {
    handledWindows.add(id);
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      dialog.showMessageBox(mainWindow, {
        type: "info",
        buttons: ["OK"],
        title: "Reppic",
        message: "Log eerst in",
        detail:
          "Log één keer in in het Reppic-venster. Daarna worden je gesprekken automatisch opgenomen en bij jouw account geanalyseerd.",
      });
    }
    return;
  }

  // Toon de opname-chip (always-on-top, inactief getoond) i.p.v. een
  // systeemdialoog: de meeting blijft de actieve app, het chipje zweeft
  // eroverheen. promptOpen voorkomt dubbele chips; hij wordt gereset zodra de
  // gebruiker in de chip kiest (zie de ipcMain-handlers).
  promptOpen = true;
  log(`gesprek gedetecteerd (${window.platform || "meeting"}) → opname-chip getoond (account: ${tokenEmail()})`);
  showChip(window);
}

// Leest localStorage.token uit het venster; nieuw token → bewaren + melden.
async function syncTokenFromRenderer(win) {
  try {
    // Never touch localStorage on a foreign origin — the token must only be
    // read from / written to the real Reppic app.
    if (!isReppicOrigin(win.webContents.getURL())) return;
    const value = await win.webContents.executeJavaScript(
      'window.localStorage.getItem("token")',
      true
    );
    if (value && value !== authToken) {
      persistToken(value);
      log("✓ ingelogd als", tokenEmail(), "— token bewaard");
    }
  } catch {
    /* pagina nog niet klaar */
  }
}

app.whenReady().then(async () => {
  TOKEN_FILE = path.join(app.getPath("userData"), "reppic-auth.json");
  loadStoredToken();
  log(authToken ? `sessie geladen (${tokenEmail()})` : "nog niet ingelogd");

  createChipWindow();

  try {
    await RecallAiSdk.init({
      apiUrl: RECALL_API_URL,
      acquirePermissionsOnStartup: [
        "accessibility",
        "screen-capture",
        "microphone",
        "system-audio",
      ],
    });
    log("SDK init ok (apiUrl:", RECALL_API_URL + ")");
  } catch (e) {
    log("SDK init FOUT:", e.message);
  }

  for (const p of [
    "screen-capture",
    "microphone",
    "system-audio",
    "accessibility",
  ]) {
    try {
      await RecallAiSdk.requestPermission(p);
    } catch {}
  }

  RecallAiSdk.addEventListener("meeting-detected", (evt) => {
    if (evt && evt.window) void onMeetingDetected(evt.window);
  });
  RecallAiSdk.addEventListener("recording-started", (evt) => {
    log("● OPNAME GESTART voor", evt && evt.window && evt.window.id);
  });
  RecallAiSdk.addEventListener("recording-ended", (evt) => {
    const id = evt && evt.window && evt.window.id;
    if (id) recording.delete(id);
    log("■ opname beëindigd voor", id, "→ upload naar Recall loopt");
  });
  RecallAiSdk.addEventListener("error", (evt) => {
    log("SDK-error:", JSON.stringify(evt));
  });
  RecallAiSdk.addEventListener("permission-status", (evt) => {
    log("permission-status:", evt && evt.permission, "=", evt && evt.status);
  });
  RecallAiSdk.addEventListener("meeting-closed", (evt) => {
    log("meeting-closed:", evt && evt.window && evt.window.id);
  });

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: "Reppic Desktop",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadURL(REPPIC_URL);

  // Ruim de (verborgen) chip op als het hoofdvenster sluit, zodat
  // window-all-closed vuurt en de app netjes afsluit.
  mainWindow.on("closed", () => {
    if (chipWindow && !chipWindow.isDestroyed()) chipWindow.destroy();
    chipWindow = null;
  });

  // Navigation allow-listing: keep the window on the Reppic origin. Block
  // top-level navigation and redirects to any other origin, and deny popups.
  const blockForeign = (event, url) => {
    if (!isReppicOrigin(url)) {
      event.preventDefault();
      log("navigatie geblokkeerd naar niet-Reppic origin:", url);
    }
  };
  mainWindow.webContents.on("will-navigate", blockForeign);
  mainWindow.webContents.on("will-redirect", blockForeign);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    log("nieuw venster geweigerd:", url);
    return { action: "deny" };
  });

  // Bij paginalaad: bestaand token injecteren zodat de webapp ingelogd blijft,
  // en een nieuw token na login oppikken. Alleen op de echte Reppic-origin.
  mainWindow.webContents.on("did-finish-load", async () => {
    if (!isReppicOrigin(mainWindow.webContents.getURL())) return;
    if (authToken) {
      try {
        await mainWindow.webContents.executeJavaScript(
          `if(!window.localStorage.getItem("token")){window.localStorage.setItem("token", ${JSON.stringify(
            authToken
          )});}`,
          true
        );
      } catch {}
    }
    await syncTokenFromRenderer(mainWindow);
  });

  // Poll voor login-succes (de webapp zet localStorage.token zonder herladen).
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      void syncTokenFromRenderer(mainWindow);
    }
  }, 2000);

  log("Klaar — luistert op meeting-detected.");
});

app.on("window-all-closed", () => {
  app.quit();
});
