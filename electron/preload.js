// electron/preload.js
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electron', {
    isElectron: true,
    platform: process.platform,
    version: '2.0.0'
})