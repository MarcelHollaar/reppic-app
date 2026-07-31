# Reppic Desktop test-shell

Minimale Electron-app om de **Desktop Recording SDK-integratie** (Recall.ai)
lokaal end-to-end te testen, zonder ToDesktop Builder.

## Wat het is

In productie wordt de webapp verpakt met **ToDesktop Builder** + de
`@todesktop/plugin-recall`-plugin. Deze test-shell gebruikt **exact dezelfde
plugin** (main-process + preload uit `@todesktop/plugin-recall`), maar draagt
hem zelf in een kale Electron-app en laadt de lokale webapp. De
`DesktopRecordingBridge` in de webapp ziet daardoor hetzelfde
`window.todesktop.recallDesktop`-API-oppervlak als in de echte desktop-app —
wat hier werkt, werkt straks in de ToDesktop-build.

Vereist een **Apple Silicon Mac of Windows** (Intel-Macs worden door de Recall
SDK niet ondersteund).

## Gebruik

Zie `../start-desktop-test.sh` — die start tunnel + app (poort 3200) + deze
shell in één keer. Handmatig:

```bash
npm install                                   # eenmalig
REPPIC_URL=http://localhost:3200 npm start
```

### Tegen de TESTOMGEVING draaien (route A)

De shell kan ook naar een gedeployde omgeving wijzen — dan test je de echte
keten zonder ToDesktop:

```bash
npm install                                            # eenmalig
REPPIC_URL=https://jouw-testdomein.nl npm start
```

Aandachtspunten die hier anders zijn dan lokaal:

- **https wordt ondersteund** sinds 2026-07-22 (de shell koos eerder altijd de
  `http`-module en kon dus geen TLS).
- **Inloggen gebeurt ín het shell-venster.** De shell leest de JWT uit de
  ingelogde sessie en gebruikt die voor `/api/recall/desktop-upload-token`.
  Zonder inloggen: `NIET_INGELOGD`.
- **De test-bypass (`DESKTOP_TEST_USER_EMAIL`) werkt hier NIET.** Die is
  structureel uitgeschakeld zodra `NODE_ENV=production`, wat op een
  testomgeving normaal het geval is. Inloggen is dus verplicht.
- Het Recall-webhook-endpoint moet naar het **testdomein** wijzen, niet naar een
  tunnel-URL.

## Vooraf configureren

1. `RECALL_API_KEY` in `app/.env` (Recall-workspace us-west-2; andere regio →
   `RECALL_API_URL`-env meegeven aan de shell én `RECALL_BASE_URL` aanpassen).
2. In het Recall-dashboard een **webhook-endpoint** aanmaken dat wijst naar
   `{publieke-app-URL}/api/webhooks/recall-sdk`, en de Svix signing-secret
   (`whsec_...`) als `RECALL_WEBHOOK_SECRET` in `app/.env` zetten.
3. Bij de eerste opname vraagt macOS om **microfoon-, schermopname- en
   accessibility-permissies** voor Electron — allemaal toestaan.

## Testflow

1. Shell start → log in als verkoper.
2. Start een Zoom/Meet/Teams-call op deze machine.
3. De SDK vuurt `meeting-detected` → de shell toont een **opname-chip**
   rechtsboven (klein, always-on-top venster) met "Opnemen" / "Niet nu".
4. Klik "Opnemen" → `startRecording`.
5. Beëindig de call → upload naar Recall → `sdk_upload.complete`-webhook →
   Conversation + AssemblyAI-transcript → analyse → zichtbaar in het dashboard.

### Waarom een chip en geen systeemdialoog

Een `dialog.showMessageBox` moet de app-focus pakken en duwt daarmee je meeting
weg (of verschijnt erachter). Recall's eigen voorbeeld-app lost dit op met een
klein always-on-top venster dat **inactief** wordt getoond (`showInactive`),
zodat de meeting de actieve app blijft. Deze shell volgt dat patroon
(`chip.html` + `chip-preload.js` + `createChipWindow`/`showChip` in `main.js`),
inclusief `setVisibleOnAllWorkspaces(..., { visibleOnFullScreen: true })` zodat
de chip ook over een schermvullende meeting verschijnt.

In de **productie**-app (ToDesktop + `@todesktop/client-recall`) komt de
opnamevraag niet uit deze Electron-chip maar uit de webapp zelf
(`DesktopRecordingBridge`), als paneel ín het Reppic-venster. De chip hier is
puur voor de test-shell.

## Beperkingen (bewust)

- Alleen voor lokaal testen: geen code-signing, geen auto-update, geen
  installer. Productie-distributie loopt via ToDesktop Builder.
- Quick-tunnel-URL (trycloudflare) wisselt per run → Recall-webhook-endpoint
  per testrun bijwerken in het Recall-dashboard.
