const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 900, minHeight: 600,
    icon: path.join(__dirname, "../public/favicon.ico"),
    title: "GNL1Z Asset Management — Sonatrach Arzew",
    backgroundColor: "#0f1117",
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: { nodeIntegration: false, contextIsolation: true, webSecurity: true },
  });
  win.loadFile(path.join(__dirname, "../dist/index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.on("closed", () => { win = null; });
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "GNL1Z", submenu: [{ label: "About", role: "about" }, { type: "separator" }, { role: "quit" }] },
    { label: "View", submenu: [{ role: "reload" }, { role: "forceReload" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
  ]));
}

app.whenReady().then(() => { buildMenu(); createWindow(); app.on("activate", () => { if (!win) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
