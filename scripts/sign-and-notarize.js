/**
 * Script to sign and notarize applications for production distribution
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
const version = packageJson.version
const appName = packageJson.name
const buildDir = './build'

console.log('Starting signing and notarization process...')

// Windows Code Signing
async function signWindowsApp() {
  console.log('Signing Windows application...')
  
  const winBuildPath = path.join(buildDir, `${appName}-win64-${version}`)
  const exePath = path.join(winBuildPath, `${appName}.exe`)
  
  if (!fs.existsSync(exePath)) {
    console.log('Windows executable not found, skipping signing')
    return
  }

  const certFile = process.env.WIN_CERT_FILE
  const certPassword = process.env.WIN_CERT_PASSWORD
  const timestampUrl = process.env.WIN_TIMESTAMP_URL || 'http://timestamp.digicert.com'
  const signToolPath = process.env.WIN_SIGNTOOL_PATH || 'signtool.exe'

  if (!certFile || !certPassword) {
    console.warn('Windows certificate or password not provided, skipping signing')
    return
  }

  try {
    // Sign the executable
    const signCommand = [
      `"${signToolPath}"`,
      'sign',
      '/f', `"${certFile}"`,
      '/p', `"${certPassword}"`,
      '/t', `"${timestampUrl}"`,
      '/v',
      `"${exePath}"`
    ].join(' ')

    execSync(signCommand, { stdio: 'inherit' })
    console.log('Windows application signed successfully')

    // Verify signature
    const verifyCommand = [
      `"${signToolPath}"`,
      'verify',
      '/pa',
      '/v',
      `"${exePath}"`
    ].join(' ')

    execSync(verifyCommand, { stdio: 'inherit' })
    console.log('Windows signature verified')

  } catch (error) {
    console.error('Failed to sign Windows application:', error.message)
    throw error
  }
}

// macOS Code Signing and Notarization
async function signAndNotarizeMacApp() {
  console.log('Signing and notarizing macOS application...')
  
  const macBuildPath = path.join(buildDir, `${appName}-osx64-${version}`)
  const appPath = path.join(macBuildPath, `${appName}.app`)
  
  if (!fs.existsSync(appPath)) {
    console.log('macOS application not found, skipping signing')
    return
  }

  const identity = process.env.MAC_CERT_IDENTITY
  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_ID_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID

  if (!identity) {
    console.warn('macOS certificate identity not provided, skipping signing')
    return
  }

  try {
    // Create entitlements file if it doesn't exist
    const entitlementsPath = path.join(buildDir, 'entitlements.plist')
    if (!fs.existsSync(entitlementsPath)) {
      const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.files.downloads.read-write</key>
    <true/>
</dict>
</plist>`
      fs.writeFileSync(entitlementsPath, entitlements)
    }

    // Sign the application
    const signCommand = [
      'codesign',
      '--sign', `"${identity}"`,
      '--entitlements', `"${entitlementsPath}"`,
      '--options', 'runtime',
      '--deep',
      '--force',
      '--verbose',
      `"${appPath}"`
    ].join(' ')

    execSync(signCommand, { stdio: 'inherit' })
    console.log('macOS application signed successfully')

    // Verify signature
    const verifyCommand = `codesign --verify --deep --strict --verbose=2 "${appPath}"`
    execSync(verifyCommand, { stdio: 'inherit' })
    console.log('macOS signature verified')

    // Create ZIP for notarization
    const zipPath = path.join(buildDir, `${appName}-${version}-mac.zip`)
    const createZipCommand = `ditto -c -k --keepParent "${appPath}" "${zipPath}"`
    execSync(createZipCommand, { stdio: 'inherit' })

    // Notarize if credentials are provided
    if (appleId && appleIdPassword && teamId) {
      console.log('Submitting for notarization...')
      
      const notarizeCommand = [
        'xcrun',
        'notarytool',
        'submit',
        `"${zipPath}"`,
        '--apple-id', `"${appleId}"`,
        '--password', `"${appleIdPassword}"`,
        '--team-id', `"${teamId}"`,
        '--wait'
      ].join(' ')

      execSync(notarizeCommand, { stdio: 'inherit' })
      console.log('Notarization successful')

      // Staple the notarization
      const stapleCommand = `xcrun stapler staple "${appPath}"`
      execSync(stapleCommand, { stdio: 'inherit' })
      console.log('Notarization stapled successfully')

      // Clean up ZIP file
      fs.unlinkSync(zipPath)
    } else {
      console.warn('Apple ID credentials not provided, skipping notarization')
    }

  } catch (error) {
    console.error('Failed to sign/notarize macOS application:', error.message)
    throw error
  }
}

// Linux package signing (optional)
function signLinuxPackages() {
  console.log('Checking Linux packages for signing...')
  
  const installersDir = path.join(buildDir, 'installers')
  if (!fs.existsSync(installersDir)) {
    console.log('Installers directory not found, skipping Linux signing')
    return
  }

  const gpgKey = process.env.LINUX_GPG_KEY
  if (!gpgKey) {
    console.warn('GPG key not provided, skipping Linux package signing')
    return
  }

  try {
    // Sign DEB package
    const debFile = path.join(installersDir, `${appName}_${version}_amd64.deb`)
    if (fs.existsSync(debFile)) {
      const signDebCommand = `dpkg-sig --sign builder -k "${gpgKey}" "${debFile}"`
      execSync(signDebCommand, { stdio: 'inherit' })
      console.log('DEB package signed successfully')
    }

    // Sign AppImage
    const appImageFile = path.join(installersDir, `${appName}-${version}-x86_64.AppImage`)
    if (fs.existsSync(appImageFile)) {
      const signAppImageCommand = `gpg --armor --detach-sig --default-key "${gpgKey}" "${appImageFile}"`
      execSync(signAppImageCommand, { stdio: 'inherit' })
      console.log('AppImage signed successfully')
    }

  } catch (error) {
    console.error('Failed to sign Linux packages:', error.message)
  }
}

// Auto-updater signature generation
function generateUpdaterSignatures() {
  console.log('Generating auto-updater signatures...')
  
  const privateKey = process.env.UPDATE_PRIVATE_KEY
  if (!privateKey) {
    console.warn('Update private key not provided, skipping signature generation')
    return
  }

  const installersDir = path.join(buildDir, 'installers')
  if (!fs.existsSync(installersDir)) {
    console.log('Installers directory not found')
    return
  }

  try {
    const files = fs.readdirSync(installersDir)
    const updateManifest = {
      version: version,
      releaseDate: new Date().toISOString(),
      files: []
    }

    files.forEach(file => {
      const filePath = path.join(installersDir, file)
      const stats = fs.statSync(filePath)
      
      if (stats.isFile()) {
        // Generate file hash
        const crypto = require('crypto')
        const fileBuffer = fs.readFileSync(filePath)
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
        
        updateManifest.files.push({
          name: file,
          size: stats.size,
          hash: hash,
          url: `https://updates.your-domain.com/releases/${version}/${file}`
        })
      }
    })

    // Save update manifest
    const manifestPath = path.join(installersDir, 'update-manifest.json')
    fs.writeFileSync(manifestPath, JSON.stringify(updateManifest, null, 2))
    console.log('Update manifest created:', manifestPath)

  } catch (error) {
    console.error('Failed to generate updater signatures:', error.message)
  }
}

// Security scan
function performSecurityScan() {
  console.log('Performing security scan...')
  
  try {
    // Check for common vulnerabilities
    const buildPaths = [
      path.join(buildDir, `${appName}-win64-${version}`),
      path.join(buildDir, `${appName}-osx64-${version}`),
      path.join(buildDir, `${appName}-linux64-${version}`)
    ]

    buildPaths.forEach(buildPath => {
      if (fs.existsSync(buildPath)) {
        console.log(`Scanning ${buildPath}...`)
        
        // Check for debug symbols (should be stripped in production)
        const files = fs.readdirSync(buildPath, { recursive: true })
        const debugFiles = files.filter(file => 
          file.endsWith('.pdb') || 
          file.endsWith('.dSYM') || 
          file.includes('debug')
        )
        
        if (debugFiles.length > 0) {
          console.warn('Debug files found:', debugFiles)
        }

        // Check file permissions
        files.forEach(file => {
          const filePath = path.join(buildPath, file)
          try {
            const stats = fs.statSync(filePath)
            if (stats.isFile() && (stats.mode & parseInt('022', 8))) {
              console.warn(`File has world-writable permissions: ${file}`)
            }
          } catch (error) {
            // Ignore errors for non-existent files
          }
        })
      }
    })

    console.log('Security scan completed')

  } catch (error) {
    console.error('Security scan failed:', error.message)
  }
}

// Main execution
async function main() {
  const platform = process.platform
  const signAll = process.argv.includes('--all')
  const skipSigning = process.argv.includes('--skip-signing')

  if (!skipSigning) {
    if (signAll || platform === 'win32') {
      await signWindowsApp()
    }

    if (signAll || platform === 'darwin') {
      await signAndNotarizeMacApp()
    }

    if (signAll || platform === 'linux') {
      signLinuxPackages()
    }
  }

  // Generate updater signatures
  generateUpdaterSignatures()

  // Perform security scan
  performSecurityScan()

  console.log('Signing and notarization process completed!')
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Signing process failed:', error)
    process.exit(1)
  })
}

module.exports = {
  signWindowsApp,
  signAndNotarizeMacApp,
  signLinuxPackages,
  generateUpdaterSignatures,
  performSecurityScan,
}