const { ipcMain } = require('electron');
const pageParser = require('../services/pageParser');
const { assertHttpsWebUrl } = require('../utils/requireHttpsUrl');

function registerParserIpc() {
  ipcMain.handle('parser:parsePage', async (_, source, viewport, requestOptions) => {
    if (!source || typeof source !== 'string') {
      throw new Error('Page URL is required (https only)');
    }
    assertHttpsWebUrl(source, { allowEmpty: false, fieldName: 'Page URL' });
    const elements = await pageParser.parsePage(source, viewport || null, requestOptions || null);
    return elements;
  });
}

module.exports = registerParserIpc;
