import { LauncherAppPlugin } from '@xmcl/runtime/app'
import { autoUpdater } from 'electron-updater'
import { kSettings } from '~/settings'
import { dialog, BrowserWindow, app } from 'electron'

export const pluginAutoUpdate: LauncherAppPlugin = async (launcherApp) => {
  // E2E hook: skip the auto-updater entirely when running under Playwright.
  // The updater hits real network endpoints and would otherwise add nondeterminism.
  if (process.env.XMCL_E2E) {
    return
  }
  const state = await launcherApp.registry.get(kSettings)
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

  // Versions that are considered critical/forced updates
  const FORCED_UPDATE_VERSIONS = ['0.66.5'] // Add versions that require forced update

  // Check for updates when app is ready
  launcherApp.whenReady().then(() => {
    setTimeout(() => {
      checkForUpdates(launcherApp)
    }, 5000) // Check after 5 seconds of app launch
  })

  // Function to check for updates
  async function checkForUpdates(launcherApp: any) {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result && result.updateInfo && result.updateInfo.version !== launcherApp.version) {
        const newVersion = result.updateInfo.version
        const currentVersion = launcherApp.version

        // Check if this is a forced update
        const isForcedUpdate = FORCED_UPDATE_VERSIONS.includes(newVersion)

        const mainWindow = BrowserWindow.getAllWindows()[0]
        if (mainWindow) {
          if (isForcedUpdate) {
            // Forced update dialog - user MUST update or exit
            const resultDialog = await dialog.showMessageBox(mainWindow, {
              type: 'warning',
              title: '⚠️ Critical Update Required',
              message: `Critical Update Required!`,
              detail: `Nebula Launcher ${newVersion} is available and is required for security and performance reasons.\n\nYou are currently running version ${currentVersion}.\n\nYou must update to continue using the application.`,
              buttons: ['Update Now', 'Exit'],
              defaultId: 0,
              cancelId: 1,
              noLink: true,
              closable: false // Prevent closing without choosing
            })

            if (resultDialog.response === 0) {
              // User chose to update
              autoUpdater.downloadUpdate()
            } else {
              // User chose to exit
              launcherApp.quit()
            }
          } else {
            // Optional update dialog - user can choose to update later
            const resultDialog = await dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Update Available',
              message: `Nebula Launcher ${newVersion} is available!`,
              detail: `You are currently running version ${currentVersion}. Would you like to download and install the update now?`,
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