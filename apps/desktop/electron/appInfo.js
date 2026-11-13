'use strict';

const { app } = require('electron');

/**
 * Что за сборка запущена: версия, канал, платформа.
 *
 * Один источник для экрана «О программе», для шапки сохранённого журнала и
 * для поддержки. Канал пока один: community-сборка, отдельного enterprise нет.
 */

const CHANNEL = 'community';

function getAppInfo() {
  return {
    version: app.getVersion(),
    name: app.getName(),
    channel: CHANNEL,
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
  };
}

module.exports = { CHANNEL, getAppInfo };
