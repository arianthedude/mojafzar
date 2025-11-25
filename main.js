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
  const ip = cfg.ip;
  const url = `http://${ip}:3000/s/?mmk&u=${encodeURIComponent(
    cfg.username
  )}&p=${encodeURIComponent(cfg.password)}`;

  try {
    if (view) {
      if (!view.webContents.isDestroyed()) mainWindow.removeBrowserView(view);
      view = null;
    }

    view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    mainWindow.setBrowserView(view);

    const [w, h] = mainWindow.getContentSize();
    view.setBounds({ x: 0, y: 80, width: w, height: h - 80 });
    view.setAutoResize({ width: true, height: true });

    const failPromise = new Promise((_, reject) => {
      view.webContents.once(
        "did-fail-load",
        (event, errorCode, errorDescription, validatedURL) => {
          reject(
            new Error(
              `Failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`
            )
          );
        }
      );
    });

    await Promise.race([loadURLWithTimeout(view, url, 5000), failPromise]);

    if (view && !view.webContents.isDestroyed()) {
      mainWindow.removeBrowserView(view);
      view = null;
    }

    await mainWindow.loadFile(path.join(__dirname, "renderer", "success.html"));
    mainWindow.webContents.send("show-success-screen", cfg);

    return { url };
  } catch (err) {
    console.error("Open URL error:", err);

    if (view && !view.webContents.isDestroyed()) {
      mainWindow.removeBrowserView(view);
      view = null;
    }

    // Map common errors to custom messages
    let message = err.message;
    if (message.includes("ERR_CONNECTION_TIMED_OUT")) {
      message = "Cannot connect to server. Check your IP and network.";
    } else if (message.includes("ERR_NAME_NOT_RESOLVED")) {
      message = "Server address could not be resolved.";
    }

    await dialog.showMessageBox({
      type: "error",
      title: "Failed to open server",
      message,
      buttons: ["OK"],
    });

    return { error: message };
  }
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
