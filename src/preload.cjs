const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("radianceDesktop", {
  close: () => ipcRenderer.send("overlay:close"),
  minimize: () => ipcRenderer.send("overlay:minimize"),
  setAlwaysOnTop: (enabled) => ipcRenderer.send("overlay:toggle-top", enabled),
  platform: process.platform
});
