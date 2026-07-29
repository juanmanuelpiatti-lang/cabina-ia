'use strict';

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const os = require('os');
const { createServer } = require('./server');

const PORT = 4173;
let mainWindow = null;
let httpServer = null;

function getLanUrl() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
          for (const net of nets[name]) {
                  if (net.family === 'IPv4' && !net.internal) return 'http://' + net.address + ':' + PORT;
          }
    }
    return null;
}

async function createWindow() {
    const userDataDir = app.getPath('userData');
    const configPath = path.join(userDataDir, 'stations.json');
    const rendererDir = path.join(__dirname, '..', 'renderer');

  httpServer = await createServer({ configPath: configPath, rendererDir: rendererDir, port: PORT });

  mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1100,
        minHeight: 700,
        title: 'Cabina IA - Productor Virtual',
        webPreferences: { contextIsolation: true, nodeIntegration: false }
  });

  mainWindow.setMenuBarVisibility(false);
    mainWindow.loadURL('http://localhost:' + PORT);

  const lanUrl = getLanUrl();
    if (lanUrl) {
          console.log('Cabina IA tambien disponible en la red local en: ' + lanUrl);
    }

  mainWindow.webContents.setWindowOpenHandler(function (details) {
        shell.openExternal(details.url);
        return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (httpServer) httpServer.close();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

module.exports = { getLanUrl: getLanUrl, PORT: PORT };
