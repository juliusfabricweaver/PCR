/**
 * NW.js build configuration for production packaging
 */
const path = require('path')
const fs = require('fs')

// Get version from package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
const version = packageJson.version

module.exports = {
  // Source files
  srcDir: '.',
  
  // Output directory
  outDir: './build',
  
  // Platforms to build for
  platforms: ['win64', 'osx64', 'linux64'],
  
  // NW.js version to use
  version: '0.83.0',
  
  // Flavor (sdk for development, normal for production)
  flavor: 'normal',
  
  // Application details
  app: {
    name: 'PCR Application',
    version: version,
    description: 'Modern Patient Care Report application',
    author: 'Healthcare Team',
    license: 'MIT',
  },
  
  // Build options
  buildType: 'versioned',
  
  // Cache options
  cacheDir: './nw-cache',
  
  // Files to include/exclude
  files: [
    './dist/**/*',
    './main.js',
    './package.json',
    './public/favicon.ico',
    './public/icons/**/*',
    '!./src/**/*',
    '!./node_modules/**/*',
    '!./.git/**/*',
    '!./.cache/**/*',
    '!./build/**/*',
    '!./nw-cache/**/*',
  ],
  
  // Windows specific options
  winIco: './public/icons/icon-256x256.png',
  winVersionString: {
    CompanyName: 'Healthcare Solutions',
    ProductName: 'PCR Application',
    ProductVersion: version,
    FileVersion: version,
    FileDescription: 'Patient Care Report Application',
    LegalCopyright: '© 2024 Healthcare Solutions',
    InternalName: 'pcr-app',
    OriginalFilename: 'pcr-app.exe',
  },
  
  // macOS specific options
  macIcns: './public/icons/icon.icns',
  macPlist: {
    CFBundleName: 'PCR Application',
    CFBundleDisplayName: 'PCR Application',
    CFBundleIdentifier: 'com.healthcare.pcr-app',
    CFBundleVersion: version,
    CFBundleShortVersionString: version,
    NSHumanReadableCopyright: '© 2024 Healthcare Solutions',
    NSRequiresAquaSystemAppearance: false, // Support dark mode
    NSHighResolutionCapable: true,
    LSMinimumSystemVersion: '10.14.0',
  },
  
  // Linux specific options
  linuxIcon: './public/icons/icon-256x256.png',
  
  // Zip options
  zip: {
    win64: true,
    osx64: true,
    linux64: true,
  },
  
  // Additional options
  options: {
    // Include dev tools in production (set to false for final release)
    includeDevTools: false,
    
    // Minify JavaScript
    minifyJS: true,
    
    // Compress with UPX (requires UPX to be installed)
    useUPX: false,
    
    // Code signing (configure for production)
    codeSign: {
      // Windows code signing
      win: {
        certificateFile: process.env.WIN_CERT_FILE,
        certificatePassword: process.env.WIN_CERT_PASSWORD,
        timestampUrl: 'http://timestamp.digicert.com',
        signToolPath: process.env.WIN_SIGNTOOL_PATH,
      },
      
      // macOS code signing
      mac: {
        identity: process.env.MAC_CERT_IDENTITY,
        entitlements: './build-assets/entitlements.plist',
        entitlementsInherit: './build-assets/entitlements.plist',
        hardenedRuntime: true,
      },
    },
    
    // Notarization for macOS
    notarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    },
    
    // Auto-updater configuration
    autoUpdater: {
      enabled: true,
      updateUrl: 'https://updates.your-domain.com/pcr-app',
      checkInterval: 60 * 60 * 1000, // Check every hour
    },
  },
  
  // Custom build steps
  buildSteps: [
    // Pre-build: Clean and prepare
    {
      name: 'pre-build',
      command: 'npm run build',
      when: 'before',
    },
    
    // Post-build: Create installers
    {
      name: 'create-installers',
      command: 'node ./scripts/create-installers.js',
      when: 'after',
    },
    
    // Post-build: Sign and notarize
    {
      name: 'sign-and-notarize',
      command: 'node ./scripts/sign-and-notarize.js',
      when: 'after',
      condition: 'production',
    },
  ],
}