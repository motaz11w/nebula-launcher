import { LauncherAppPlugin } from '@xmcl/runtime/app'
import { autoUpdater } from 'electron-updater'
import { kSettings } from '~/settings'
import { dialog, BrowserWindow } from 'electron'

export const pluginAutoUpdate: LauncherAppPlugin = async (app) => {
  // E2E hook: skip the auto-updater entirely when running under Playwright.
  // The updater hits real network endpoints and would otherwise add nondeterminism.
  if (process.env.XMCL_E2E) {
    return
  }
  const state = await app.registry.get(kSettings)
  state.subscribe('autoInstallOnAppQuitSet', (value) => {
    autoUpdater.autoInstallOnAppQuit = value
  }).subscribe('allowPrereleaseSet', (value) => {
    autoUpdater.allowPrerelease = value
  }).subscribe('autoDownloadSet', (value) => {
    autoUpdater.autoDownload = value
  }).subscribe('config', (config) => {
    autoUpdater.autoInstallOnAppQuit = config.autoInstallOnAppQuit
    autoUpdater.allowPrerelease = config.allowPrerelease
    autoUpdater.autoDownload = config.autoDownload
  })

  // Set up auto-updater events
  autoUpdater.autoDownload = false // Don't auto-download, let user decide

  // Check for updates when app is ready
  app.whenReady().then(() => {
    setTimeout(() => {
      checkForUpdates()
    }, 5000) // Check after 5 seconds of app launch
  })

  // Function to check for updates
  async function checkForUpdates() {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result && result.updateInfo && result.updateInfo.version !== app.version) {
        // Update available - show notification
        const mainWindow = BrowserWindow.getAllWindows()[0]
        if (mainWindow) {
          const resultDialog = await dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `Nebula Launcher ${result.updateInfo.version} is available!`,
            detail: `You are currently running version ${app.version}. Would you like to download and install the update now?`,
            buttons: ['Download & Install', 'Later'],
            defaultId: 0,
            cancelId: 1
          })

          if (resultDialog.response === 0) {
            // User chose to install
            autoUpdater.downloadUpdate()
          }
        }
      }
    } catch (error) {
      console.error('Auto-update check failed:', error)
    }
  }

  // Handle download progress
  autoUpdater.on('download-progress', (progress) => {
    console.log(`Download progress: ${Math.round(progress.percent)}%`)
  })

  // Handle update downloaded
  autoUpdater.on('update-downloaded', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded successfully',
        detail: 'The update will be installed when you restart the application. Would you like to restart now?',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
    }
  })

  // Handle errors
  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error)
  })
}