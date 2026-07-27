const { app, BrowserWindow, desktopCapturer, ipcMain, session } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const screenshotArg = process.argv.find((arg) => arg.startsWith("--screenshot="));
const screenshotDelayArg = process.argv.find((arg) => arg.startsWith("--screenshot-delay="));
const screenshotDelay = Math.max(
  250,
  Number(screenshotDelayArg?.slice("--screenshot-delay=".length)) || 1800
);
let overlay;

function createOverlay() {
  overlay = new BrowserWindow({
    width: 390,
    height: 650,
    minWidth: 330,
    minHeight: 540,
    maxWidth: 620,
    maxHeight: 920,
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: true,
    backgroundColor: "#00000000",
    title: "Radiance",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  overlay.setAlwaysOnTop(true, "floating");
  overlay.loadFile(path.join(__dirname, "renderer", "index.html"));

  if (screenshotArg) {
    overlay.webContents.once("did-finish-load", async () => {
      await new Promise((resolve) => setTimeout(resolve, screenshotDelay));
      const output = path.resolve(ROOT, screenshotArg.slice("--screenshot=".length));
      await fs.mkdir(path.dirname(output), { recursive: true });
      const image = await overlay.capturePage();
      await fs.writeFile(output, image.toPNG());
      console.log(`Radiance screenshot: ${output}`);
      app.quit();
    });
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media" || permission === "display-capture");
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const [screen] = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 0, height: 0 }
      });
      callback({ video: screen, audio: "loopback" });
    } catch {
      callback({});
    }
  });

  createOverlay();
});

ipcMain.on("overlay:close", () => overlay?.close());
ipcMain.on("overlay:minimize", () => overlay?.minimize());
ipcMain.on("overlay:toggle-top", (_event, enabled) => {
  overlay?.setAlwaysOnTop(Boolean(enabled), "floating");
});

app.on("window-all-closed", () => app.quit());
