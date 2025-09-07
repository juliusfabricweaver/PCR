/**
 * Script to create installers for different platforms
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
const version = packageJson.version
const appName = packageJson.name
const buildDir = './build'

console.log('Creating installers...')

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
  console.error('Build directory does not exist. Run build first.')
  process.exit(1)
}

// Windows Installer (using Inno Setup or NSIS)
function createWindowsInstaller() {
  console.log('Creating Windows installer...')
  
  const winBuildPath = path.join(buildDir, `${appName}-win64-${version}`)
  if (!fs.existsSync(winBuildPath)) {
    console.log('Windows build not found, skipping installer creation')
    return
  }

  // Create Inno Setup script
  const innoScript = `
[Setup]
AppName=${packageJson.name}
AppVersion=${version}
AppPublisher=Healthcare Solutions
AppPublisherURL=https://your-domain.com
AppSupportURL=https://your-domain.com/support
AppUpdatesURL=https://your-domain.com/updates
DefaultDirName={autopf}\\${packageJson.name}
DefaultGroupName=${packageJson.name}
OutputDir=..\\installers
OutputBaseFilename=${appName}-setup-${version}
Compression=lzma2/max
SolidCompression=yes
SetupIconFile=..\\public\\icons\\icon-256x256.ico
UninstallDisplayIcon={app}\\${appName}.exe
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 0,6.1

[Files]
Source: "${winBuildPath}\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\\${packageJson.name}"; Filename: "{app}\\${appName}.exe"
Name: "{group}\\{cm:UninstallProgram,${packageJson.name}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\\${packageJson.name}"; Filename: "{app}\\${appName}.exe"; Tasks: desktopicon
Name: "{userappdata}\\Microsoft\\Internet Explorer\\Quick Launch\\${packageJson.name}"; Filename: "{app}\\${appName}.exe"; Tasks: quicklaunchicon

[Run]
Filename: "{app}\\${appName}.exe"; Description: "{cm:LaunchProgram,${packageJson.name}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{userappdata}\\${packageJson.name}"
`

  // Write Inno Setup script
  const scriptPath = path.join(buildDir, 'installer.iss')
  fs.writeFileSync(scriptPath, innoScript)

  try {
    // Run Inno Setup compiler (requires Inno Setup to be installed)
    execSync(`iscc "${scriptPath}"`, { stdio: 'inherit' })
    console.log('Windows installer created successfully')
  } catch (error) {
    console.warn('Failed to create Windows installer (Inno Setup not found):', error.message)
  }
}

// macOS Installer (using create-dmg)
function createMacInstaller() {
  console.log('Creating macOS installer...')
  
  const macBuildPath = path.join(buildDir, `${appName}-osx64-${version}`)
  if (!fs.existsSync(macBuildPath)) {
    console.log('macOS build not found, skipping installer creation')
    return
  }

  const installersDir = path.join(buildDir, 'installers')
  if (!fs.existsSync(installersDir)) {
    fs.mkdirSync(installersDir, { recursive: true })
  }

  try {
    // Create DMG using create-dmg (install with: npm install -g create-dmg)
    const dmgPath = path.join(installersDir, `${appName}-${version}.dmg`)
    
    execSync([
      'create-dmg',
      '--volname', `"${packageJson.name} ${version}"`,
      '--volicon', '"public/icons/icon.icns"',
      '--window-pos', '200 120',
      '--window-size', '600 400',
      '--icon-size', '100',
      '--app-drop-link', '425 120',
      `"${dmgPath}"`,
      `"${macBuildPath}"`
    ].join(' '), { stdio: 'inherit' })
    
    console.log('macOS installer created successfully')
  } catch (error) {
    console.warn('Failed to create macOS installer:', error.message)
  }
}

// Linux packages (AppImage, DEB, RPM)
function createLinuxPackages() {
  console.log('Creating Linux packages...')
  
  const linuxBuildPath = path.join(buildDir, `${appName}-linux64-${version}`)
  if (!fs.existsSync(linuxBuildPath)) {
    console.log('Linux build not found, skipping package creation')
    return
  }

  createAppImage(linuxBuildPath)
  createDebPackage(linuxBuildPath)
}

function createAppImage(buildPath) {
  try {
    // Create AppImage structure
    const appImageDir = path.join(buildDir, 'AppImage')
    const appDir = path.join(appImageDir, `${appName}.AppDir`)
    
    if (fs.existsSync(appImageDir)) {
      fs.rmSync(appImageDir, { recursive: true })
    }
    fs.mkdirSync(appDir, { recursive: true })

    // Copy application files
    execSync(`cp -r "${buildPath}"/* "${appDir}/"`)

    // Create .desktop file
    const desktopFile = `
[Desktop Entry]
Type=Application
Name=${packageJson.name}
Comment=${packageJson.description}
Exec=${appName}
Icon=${appName}
Categories=Office;
Terminal=false
StartupNotify=true
`
    fs.writeFileSync(path.join(appDir, `${appName}.desktop`), desktopFile)

    // Copy icon
    execSync(`cp public/icons/icon-256x256.png "${appDir}/${appName}.png"`)

    // Create AppRun script
    const appRunScript = `#!/bin/bash
HERE="$(dirname "$(readlink -f "\${0}")")"
exec "\${HERE}/${appName}" "$@"
`
    fs.writeFileSync(path.join(appDir, 'AppRun'), appRunScript)
    execSync(`chmod +x "${path.join(appDir, 'AppRun')}"`)

    // Create AppImage (requires appimagetool)
    const installersDir = path.join(buildDir, 'installers')
    if (!fs.existsSync(installersDir)) {
      fs.mkdirSync(installersDir, { recursive: true })
    }

    execSync([
      'appimagetool',
      `"${appDir}"`,
      `"${path.join(installersDir, `${appName}-${version}-x86_64.AppImage`)}"`
    ].join(' '), { stdio: 'inherit' })

    console.log('AppImage created successfully')
  } catch (error) {
    console.warn('Failed to create AppImage:', error.message)
  }
}

function createDebPackage(buildPath) {
  try {
    // Create DEB package structure
    const debDir = path.join(buildDir, 'deb')
    const packageDir = path.join(debDir, `${appName}_${version}`)
    const debianDir = path.join(packageDir, 'DEBIAN')
    const optDir = path.join(packageDir, 'opt', appName)
    const applicationsDir = path.join(packageDir, 'usr', 'share', 'applications')
    const iconsDir = path.join(packageDir, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps')

    if (fs.existsSync(debDir)) {
      fs.rmSync(debDir, { recursive: true })
    }
    fs.mkdirSync(debianDir, { recursive: true })
    fs.mkdirSync(optDir, { recursive: true })
    fs.mkdirSync(applicationsDir, { recursive: true })
    fs.mkdirSync(iconsDir, { recursive: true })

    // Copy application files
    execSync(`cp -r "${buildPath}"/* "${optDir}/"`)

    // Create control file
    const controlFile = `Package: ${appName}
Version: ${version}
Section: utils
Priority: optional
Architecture: amd64
Maintainer: Healthcare Solutions <support@your-domain.com>
Description: ${packageJson.description}
 Modern Patient Care Report application built with NW.js
`
    fs.writeFileSync(path.join(debianDir, 'control'), controlFile)

    // Create .desktop file
    const desktopFile = `
[Desktop Entry]
Type=Application
Name=${packageJson.name}
Comment=${packageJson.description}
Exec=/opt/${appName}/${appName}
Icon=${appName}
Categories=Office;
Terminal=false
StartupNotify=true
`
    fs.writeFileSync(path.join(applicationsDir, `${appName}.desktop`), desktopFile)

    // Copy icon
    execSync(`cp public/icons/icon-256x256.png "${path.join(iconsDir, `${appName}.png`)}"`)

    // Build DEB package
    const installersDir = path.join(buildDir, 'installers')
    if (!fs.existsSync(installersDir)) {
      fs.mkdirSync(installersDir, { recursive: true })
    }

    execSync(`dpkg-deb --build "${packageDir}" "${path.join(installersDir, `${appName}_${version}_amd64.deb`)}"`, 
             { stdio: 'inherit' })

    console.log('DEB package created successfully')
  } catch (error) {
    console.warn('Failed to create DEB package:', error.message)
  }
}

// Main execution
function main() {
  const installersDir = path.join(buildDir, 'installers')
  if (!fs.existsSync(installersDir)) {
    fs.mkdirSync(installersDir, { recursive: true })
  }

  // Check platform and create appropriate installer
  const platform = process.platform
  const createAll = process.argv.includes('--all')

  if (createAll || platform === 'win32') {
    createWindowsInstaller()
  }

  if (createAll || platform === 'darwin') {
    createMacInstaller()
  }

  if (createAll || platform === 'linux') {
    createLinuxPackages()
  }

  console.log('Installer creation completed!')
  console.log(`Installers are available in: ${installersDir}`)
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = {
  createWindowsInstaller,
  createMacInstaller,
  createLinuxPackages,
}