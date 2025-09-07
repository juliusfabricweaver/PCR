/**
 * Auto-updater service for NW.js application
 */
const fs = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')
const { execSync } = require('child_process')

class AutoUpdater {
  constructor(options = {}) {
    this.updateUrl = options.updateUrl || 'https://updates.your-domain.com/pcr-app'
    this.currentVersion = this.getCurrentVersion()
    this.checkInterval = options.checkInterval || 60 * 60 * 1000 // 1 hour
    this.downloadDir = options.downloadDir || path.join(process.cwd(), 'updates')
    this.autoDownload = options.autoDownload !== false
    this.autoInstall = options.autoInstall || false
    this.logger = options.logger || console
    
    this.isChecking = false
    this.isDownloading = false
    this.checkTimer = null
    
    // Event handlers
    this.onUpdateAvailable = options.onUpdateAvailable || (() => {})
    this.onUpdateDownloaded = options.onUpdateDownloaded || (() => {})
    this.onUpdateError = options.onUpdateError || (() => {})
    this.onUpdateProgress = options.onUpdateProgress || (() => {})
  }

  /**
   * Get current application version
   */
  getCurrentVersion() {
    try {
      const packagePath = path.join(process.cwd(), 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
      return packageJson.version
    } catch (error) {
      this.logger.error('Failed to get current version:', error)
      return '0.0.0'
    }
  }

  /**
   * Start automatic update checking
   */
  start() {
    this.logger.info('Auto-updater started')
    
    // Check for updates immediately
    this.checkForUpdates()
    
    // Set up periodic checks
    this.checkTimer = setInterval(() => {
      this.checkForUpdates()
    }, this.checkInterval)
  }

  /**
   * Stop automatic update checking
   */
  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
    this.logger.info('Auto-updater stopped')
  }

  /**
   * Check for available updates
   */
  async checkForUpdates() {
    if (this.isChecking) {
      this.logger.debug('Update check already in progress')
      return
    }

    this.isChecking = true
    this.logger.info('Checking for updates...')

    try {
      const manifest = await this.fetchUpdateManifest()
      
      if (this.isNewerVersion(manifest.version, this.currentVersion)) {
        this.logger.info(`Update available: ${manifest.version}`)
        
        const updateInfo = {
          version: manifest.version,
          releaseDate: manifest.releaseDate,
          releaseNotes: manifest.releaseNotes,
          files: manifest.files,
          currentVersion: this.currentVersion,
        }

        this.onUpdateAvailable(updateInfo)

        if (this.autoDownload) {
          await this.downloadUpdate(updateInfo)
        }
      } else {
        this.logger.info('Application is up to date')
      }
    } catch (error) {
      this.logger.error('Failed to check for updates:', error)
      this.onUpdateError(error)
    } finally {
      this.isChecking = false
    }
  }

  /**
   * Download update files
   */
  async downloadUpdate(updateInfo) {
    if (this.isDownloading) {
      this.logger.debug('Download already in progress')
      return
    }

    this.isDownloading = true
    this.logger.info(`Downloading update ${updateInfo.version}...`)

    try {
      // Ensure download directory exists
      if (!fs.existsSync(this.downloadDir)) {
        fs.mkdirSync(this.downloadDir, { recursive: true })
      }

      // Determine which file to download based on platform
      const platformFile = this.getPlatformFile(updateInfo.files)
      if (!platformFile) {
        throw new Error('No update file available for current platform')
      }

      const downloadPath = path.join(this.downloadDir, platformFile.name)
      
      // Download the file
      await this.downloadFile(platformFile.url, downloadPath, (progress) => {
        this.onUpdateProgress(progress)
      })

      // Verify file integrity
      await this.verifyFileIntegrity(downloadPath, platformFile.hash)

      this.logger.info(`Update downloaded: ${downloadPath}`)
      
      const downloadedUpdate = {
        ...updateInfo,
        filePath: downloadPath,
        fileName: platformFile.name,
      }

      this.onUpdateDownloaded(downloadedUpdate)

      if (this.autoInstall) {
        await this.installUpdate(downloadedUpdate)
      }
    } catch (error) {
      this.logger.error('Failed to download update:', error)
      this.onUpdateError(error)
    } finally {
      this.isDownloading = false
    }
  }

  /**
   * Install downloaded update
   */
  async installUpdate(updateInfo) {
    this.logger.info(`Installing update ${updateInfo.version}...`)

    try {
      const platform = process.platform
      const filePath = updateInfo.filePath

      if (platform === 'win32') {
        await this.installWindowsUpdate(filePath)
      } else if (platform === 'darwin') {
        await this.installMacUpdate(filePath)
      } else if (platform === 'linux') {
        await this.installLinuxUpdate(filePath)
      } else {
        throw new Error(`Unsupported platform: ${platform}`)
      }

    } catch (error) {
      this.logger.error('Failed to install update:', error)
      this.onUpdateError(error)
      throw error
    }
  }

  /**
   * Install Windows update
   */
  async installWindowsUpdate(filePath) {
    // For Windows, we typically use an installer
    if (filePath.endsWith('.exe')) {
      // Launch installer and exit current application
      execSync(`start "" "${filePath}" /S`, { detached: true })
      this.logger.info('Installer launched, application will restart')
      process.exit(0)
    } else {
      throw new Error('Unsupported Windows update format')
    }
  }

  /**
   * Install macOS update
   */
  async installMacUpdate(filePath) {
    if (filePath.endsWith('.dmg')) {
      // Mount DMG and copy application
      const mountPoint = '/Volumes/PCR Application'
      execSync(`hdiutil attach "${filePath}"`)
      
      const appPath = path.join(mountPoint, 'PCR Application.app')
      const installPath = '/Applications/PCR Application.app'
      
      // Remove old version and copy new one
      if (fs.existsSync(installPath)) {
        execSync(`rm -rf "${installPath}"`)
      }
      
      execSync(`cp -R "${appPath}" "${installPath}"`)
      execSync(`hdiutil detach "${mountPoint}"`)
      
      this.logger.info('Update installed, please restart the application')
    } else {
      throw new Error('Unsupported macOS update format')
    }
  }

  /**
   * Install Linux update
   */
  async installLinuxUpdate(filePath) {
    if (filePath.endsWith('.AppImage')) {
      // Replace current AppImage
      const currentPath = process.execPath
      const backupPath = currentPath + '.backup'
      
      // Create backup
      fs.copyFileSync(currentPath, backupPath)
      
      try {
        // Replace with new version
        fs.copyFileSync(filePath, currentPath)
        fs.chmodSync(currentPath, '755')
        
        this.logger.info('Update installed, please restart the application')
      } catch (error) {
        // Restore backup on failure
        fs.copyFileSync(backupPath, currentPath)
        throw error
      } finally {
        // Clean up backup
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath)
        }
      }
    } else if (filePath.endsWith('.deb')) {
      // Install DEB package
      execSync(`sudo dpkg -i "${filePath}"`)
      this.logger.info('Update installed via package manager')
    } else {
      throw new Error('Unsupported Linux update format')
    }
  }

  /**
   * Fetch update manifest from server
   */
  async fetchUpdateManifest() {
    return new Promise((resolve, reject) => {
      const manifestUrl = `${this.updateUrl}/update-manifest.json`
      
      https.get(manifestUrl, (response) => {
        let data = ''
        
        response.on('data', (chunk) => {
          data += chunk
        })
        
        response.on('end', () => {
          try {
            const manifest = JSON.parse(data)
            resolve(manifest)
          } catch (error) {
            reject(new Error('Invalid manifest format'))
          }
        })
      }).on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * Download file with progress tracking
   */
  async downloadFile(url, filePath, onProgress) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath)
      
      https.get(url, (response) => {
        const totalSize = parseInt(response.headers['content-length'], 10)
        let downloadedSize = 0
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length
          
          if (onProgress && totalSize > 0) {
            const progress = {
              percent: (downloadedSize / totalSize) * 100,
              transferred: downloadedSize,
              total: totalSize,
            }
            onProgress(progress)
          }
        })
        
        response.pipe(file)
        
        file.on('finish', () => {
          file.close()
          resolve()
        })
        
        file.on('error', (error) => {
          fs.unlink(filePath, () => {}) // Delete partial file
          reject(error)
        })
      }).on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * Verify downloaded file integrity
   */
  async verifyFileIntegrity(filePath, expectedHash) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      
      stream.on('data', (data) => {
        hash.update(data)
      })
      
      stream.on('end', () => {
        const calculatedHash = hash.digest('hex')
        if (calculatedHash === expectedHash) {
          resolve()
        } else {
          reject(new Error('File integrity check failed'))
        }
      })
      
      stream.on('error', reject)
    })
  }

  /**
   * Get appropriate file for current platform
   */
  getPlatformFile(files) {
    const platform = process.platform
    const arch = process.arch
    
    const platformPatterns = {
      win32: [/win.*\.(exe|msi)$/i, /windows.*\.(exe|msi)$/i],
      darwin: [/mac.*\.(dmg|pkg)$/i, /osx.*\.(dmg|pkg)$/i, /darwin.*\.(dmg|pkg)$/i],
      linux: [/linux.*\.(AppImage|deb|rpm)$/i, /.*\.(AppImage|deb|rpm)$/i],
    }
    
    const patterns = platformPatterns[platform] || []
    
    for (const pattern of patterns) {
      const file = files.find(f => pattern.test(f.name))
      if (file) return file
    }
    
    return null
  }

  /**
   * Compare version strings
   */
  isNewerVersion(newVersion, currentVersion) {
    const parseVersion = (version) => {
      return version.split('.').map(part => {
        const num = parseInt(part, 10)
        return isNaN(num) ? 0 : num
      })
    }
    
    const newParts = parseVersion(newVersion)
    const currentParts = parseVersion(currentVersion)
    
    const maxLength = Math.max(newParts.length, currentParts.length)
    
    for (let i = 0; i < maxLength; i++) {
      const newPart = newParts[i] || 0
      const currentPart = currentParts[i] || 0
      
      if (newPart > currentPart) return true
      if (newPart < currentPart) return false
    }
    
    return false
  }

  /**
   * Cleanup old update files
   */
  cleanup() {
    if (fs.existsSync(this.downloadDir)) {
      const files = fs.readdirSync(this.downloadDir)
      files.forEach(file => {
        const filePath = path.join(this.downloadDir, file)
        fs.unlinkSync(filePath)
      })
      this.logger.info('Cleanup completed')
    }
  }

  /**
   * Get update status
   */
  getStatus() {
    return {
      currentVersion: this.currentVersion,
      isChecking: this.isChecking,
      isDownloading: this.isDownloading,
      updateUrl: this.updateUrl,
      checkInterval: this.checkInterval,
    }
  }
}

module.exports = AutoUpdater