const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (cfg) => ipcRenderer.invoke("save-config", cfg),
  openUrl: (cfg) => ipcRenderer.invoke("open-url", cfg),
  showSettings: () => ipcRenderer.send("show-settings"),
  onShowSettingsScreen: (cb) => ipcRenderer.on("show-settings-screen", cb),
  showError: (message) => ipcRenderer.invoke("show-error", message),
  onShowSuccess: (cb) =>
    ipcRenderer.on("show-success-screen", (event, cfg) => cb(cfg)),
});