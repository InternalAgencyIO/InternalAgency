const { app, BrowserWindow, desktopCapturer, ipcMain, session } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const RENDERER_PATH = path.join(__dirname, "renderer", "index.html");
const RENDERER_URL = pathToFileURL(RENDERER_PATH).href;
const CAPTURE_GRANT_MS = 10_000;
const screenshotArg = process.argv.find((arg) => arg.startsWith("--screenshot="));
const screenshotDelayArg = process.argv.find((arg) => arg.startsWith("--screenshot-delay="));
const screenshotDelay = Math.max(
  250,
  Number(screenshotDelayArg?.slice("--screenshot-delay=".length)) || 1800
);
let overlay;
let captureGrantExpiresAt = 0;

function isTrustedRenderer(webContents, requestingUrl = webContents?.getURL()) {
  return Boolean(
    overlay
      && !overlay.isDestroyed()
      && webContents === overlay.webContents
      && requestingUrl === RENDERER_URL
  );
}

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
  overlay.webContents.on("will-frame-navigate", (event, details) => {
    if (details.url !== RENDERER_URL) event.preventDefault();
  });
  overlay.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  overlay.loadFile(RENDERER_PATH);

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
  session.defaultSession.setPermissionCheckHandler((webContents, permission, _requestingOrigin, details) => {
    const requestingUrl = details?.requestingUrl ?? webContents?.getURL();
    if (!isTrustedRenderer(webContents, requestingUrl)) return false;
    if (permission === "display-capture") return true;
    return permission === "media" && Date.now() <= captureGrantExpiresAt;
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details?.requestingUrl ?? webContents?.getURL();
    const trusted = isTrustedRenderer(webContents, requestingUrl);
    const allowed = trusted && (
      permission === "display-capture"
      || (permission === "media" && Date.now() <= captureGrantExpiresAt)
    );
    callback(allowed);
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (
      !request.userGesture
      || request.frame !== overlay?.webContents.mainFrame
      || request.frame?.url !== RENDERER_URL
      || request.securityOrigin !== "file://"
    ) {
      callback({});
      return;
    }
    captureGrantExpiresAt = Date.now() + CAPTURE_GRANT_MS;
    try {
      const [screen] = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 0, height: 0 }
      });
      callback(screen ? { video: screen, audio: "loopback" } : {});
    } catch {
      callback({});
    }
  });

  createOverlay();
});

ipcMain.on("overlay:close", (event) => {
  if (isTrustedRenderer(event.sender)) overlay?.close();
});
ipcMain.on("overlay:minimize", (event) => {
  if (isTrustedRenderer(event.sender)) overlay?.minimize();
});
ipcMain.on("overlay:toggle-top", (event, enabled) => {
  if (!isTrustedRenderer(event.sender)) return;
  overlay?.setAlwaysOnTop(Boolean(enabled), "floating");
});

app.on("window-all-closed", () => app.quit());
