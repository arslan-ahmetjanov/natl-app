const { ipcMain } = require('electron');

function registerBrowserIpc() {
  ipcMain.handle('browser:getConfig', () => {
    const userData = require('electron').app.getPath('userData');
    const browserConfig = require('../store/browserConfig');
    return browserConfig.getBrowserConfig(userData);
  });

  ipcMain.handle('browser:saveConfig', (_, config) => {
    const userData = require('electron').app.getPath('userData');
    const browserConfig = require('../store/browserConfig');
    return browserConfig.saveBrowserConfig(userData, config || {});
  });
}

module.exports = registerBrowserIpc;
