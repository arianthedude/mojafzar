const {
  app,
  BrowserWindow,
  ipcMain,
  BrowserView,
  dialog,
} = require("electron");
const path = require("path");

let store;
let mainWindow;
let view;

(async () => {
  const Store = (await import("electron-store")).default;
  store = new Store();
})();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      webviewTag: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(createWindow);

ipcMain.handle("get-config", () => ({
  ip: store.get("ip"),
  username: store.get("username"),
  password: store.get("password"),
}));

ipcMain.handle("save-config", (event, cfg) => {
  store.set("ip", cfg.ip || "");
  store.set("username", cfg.username || "");
  store.set("password", cfg.password || "");
  return { ok: true };
});

ipcMain.handle("show-error", async (event, message) => {
  await dialog.showMessageBox({
    type: "error",
    title: "Error",
    message,
    buttons: ["OK"],
  });
});

async function loadURLWithTimeout(view, url, timeout = 5000) {
  return Promise.race([
    view.webContents.loadURL(url),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Server did not respond in time")),
        timeout
      )
    ),
  ]);
}

ipcMain.handle("open-url", async (event, cfg) => {
  const testUrl = `http://${cfg.ip}/s/?mmk&u=${encodeURIComponent(
    cfg.username
  )}&p=${encodeURIComponent(cfg.password)}`;

  const finalUrl = `http://iptv.moojafzar.com/s/?mmk&u=${encodeURIComponent(
    cfg.username
  )}&p=${encodeURIComponent(cfg.password)}`;

  try {
    // Remove old view if exists
    if (view) {
      if (!view.webContents.isDestroyed()) mainWindow.removeBrowserView(view);
      view = null;
    }

    // Create hidden BrowserView just to test server response
    view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    mainWindow.setBrowserView(view);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 }); // hidden

    // Timeout + fail listener
    const failPromise = new Promise((_, reject) => {
      view.webContents.once("did-fail-load", (event, code, desc, url) => {
        reject(new Error(`Failed to load server: ${desc}`));
      });
    });

    // Try loading server URL
    await Promise.race([
      view.webContents.loadURL(testUrl),
      failPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Server timeout after 5 seconds")), 5000)
      ),
    ]);

    // Connection OK → remove BrowserView
    if (view && !view.webContents.isDestroyed()) {
      mainWindow.removeBrowserView(view);
      view = null;
    }

    // Now redirect the REAL window
    await mainWindow.loadURL(finalUrl);

    return { ok: true, redirect: finalUrl };
  } catch (err) {
    console.error("Open URL error:", err);

    if (view && !view.webContents.isDestroyed()) {
      mainWindow.removeBrowserView(view);
      view = null;
    }

    await dialog.showMessageBox({
      type: "error",
      title: "Failed to open server",
      message: err.message,
      buttons: ["OK"],
    });

    return { error: err.message };
  }
});

let keySequence = [];
const secretSequence = [
  "ArrowUp","ArrowUp","ArrowUp","ArrowUp","ArrowUp",
  "ArrowUp","ArrowUp","ArrowUp","ArrowUp","Escape"
];

app.on("browser-window-focus", () => {
  mainWindow.webContents.on("before-input-event", (event, input) => {
    keySequence.push(input.key);

    if (keySequence.length > secretSequence.length)
      keySequence.shift();

    if (secretSequence.every((k, i) => k === keySequence[i])) {
      console.log("SECRET COMBO DETECTED → OPEN SETTINGS");
      keySequence = [];

      if (view && !view.webContents.isDestroyed()) {
        mainWindow.removeBrowserView(view);
        view = null;
      }

      mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
    }
  });
});

// -------------------- Show settings screen --------------------
ipcMain.on("show-settings", () => {
  if (view && !view.webContents.isDestroyed()) {
    mainWindow.removeBrowserView(view);
    view = null;
  }

  mainWindow
    .loadFile(path.join(__dirname, "renderer", "index.html"))
    .then(() => {
      mainWindow.webContents.send("show-settings-screen");
    });
});

// -------------------- Quit app --------------------
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
