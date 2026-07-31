// Preload voor het chip-venster: legt een minimale, veilige brug bloot
// (contextIsolation aan, nodeIntegration uit) waarmee de knoppen hun keuze naar
// de main-process sturen.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chip", {
  record: () => ipcRenderer.send("chip-record"),
  dismiss: () => ipcRenderer.send("chip-dismiss"),
  onData: (cb) => ipcRenderer.on("chip-data", (_e, data) => cb(data)),
});
