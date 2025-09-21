# PCR Application - Patient Care Report System

A modern, cross-platform Patient Care Report (PCR) application designed for Emergency Medical Services (EMS) and first responders. Built with React, TypeScript, and Electron for seamless desktop and web deployment.

![PCR Application](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)

## 🚨 Overview

The PCR Application streamlines emergency medical documentation with a comprehensive digital solution that replaces traditional paper-based patient care reports. It enables first responders to quickly capture, manage, and export critical patient information during emergency situations.

### Key Features

- **Real-time Patient Documentation** - Capture comprehensive patient information during emergency responses
- **Interactive Injury Mapping** - Visual body diagram for marking and annotating injuries
- **Vital Signs Tracking** - Time-stamped vital signs monitoring with automatic calculations
- **Oxygen Protocol Management** - Built-in O2 therapy tracking with protocol compliance
- **Draft Management** - Auto-save functionality with 30-second intervals to prevent data loss
- **PDF Export** - Generate professional PCR reports for medical records
- **Role-Based Access Control** - Secure authentication with admin and user roles
- **Activity Logging** - Complete audit trail of all system activities
- **Cross-Platform Desktop App** - Native desktop experience via Electron

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI library with hooks and context
- **TypeScript** - Type-safe development experience
- **Vite** - Lightning-fast build tooling
- **Tailwind CSS** - Utility-first styling with healthcare theme

### Backend
- **Express.js** - Fast, minimalist web framework
- **TypeScript** - Type-safe API development
- **SQLite (better-sqlite3)** - High-performance embedded database
- **JWT Authentication** - Secure token-based auth
- **Joi** - Input validation
- **Winston** - Professional logging
- **Helmet** - Security middleware

### Desktop
- **Electron** - Cross-platform desktop application
- **Electron Builder** - Automated packaging and distribution

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git** (for version control)

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/pcr-application.git
cd pcr-application

# Install dependencies
npm install

# Create default user accounts
npm run create-accounts
```

### Development

```bash
# Start full development environment (frontend + backend)
npm run dev

# Start frontend only (Vite dev server on port 5173)
npm run frontend:dev

# Start backend only (Express server on port 3000)
npm run backend:dev

# Start Electron desktop app in development
npm run electron:dev
```

### Default Accounts

After running `npm run create-accounts`:
- **Admin**: username: `admin`, password: `admin`
- **User**: username: `user`, password: `user`

⚠️ **Important**: Change these passwords immediately in production!

## 📁 Project Structure

```
PCR/
├── src/
│   ├── frontend/          # React application
│   │   ├── components/    # Reusable components
│   │   │   ├── ui/        # Base UI components
│   │   │   ├── forms/     # Form components
│   │   │   ├── layout/    # Layout components
│   │   │   └── composite/ # Complex components
│   │   ├── context/       # React Context providers
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── utils/         # Utility functions
│   ├── backend/           # Express.js server
│   │   └── src/
│   │       ├── database/  # SQLite setup
│   │       ├── routes/    # API endpoints
│   │       ├── services/  # Business logic
│   │       ├── middleware/# Express middleware
│   │       └── scripts/   # Utility scripts
│   └── shared/            # Shared TypeScript types
│       └── types/         # Common interfaces
├── electron/              # Electron main process
├── public/                # Static assets
├── scripts/               # Build and deployment scripts
└── dist/                  # Production build output
```

## 🔧 Available Scripts

### Development
```bash
npm run dev              # Start full dev environment
npm run frontend:dev     # Start frontend only
npm run backend:dev      # Start backend only
npm run electron:dev     # Start desktop app in dev mode
```

### Building
```bash
npm run build            # Build frontend and backend
npm run package          # Package desktop app for current OS
npm run package:win      # Package for Windows
npm run package:mac      # Package for macOS
npm run package:linux    # Package for Linux
```

### Code Quality
```bash
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run type-check       # TypeScript type checking
npm run format           # Format with Prettier
npm run format:check     # Check formatting
```

### Testing
```bash
npm run test             # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run test:e2e         # Run Playwright E2E tests
```

### Release
```bash
npm run prepare-release  # Lint, type-check, test, and audit
npm run release          # Full release with electron-builder
```

## 📝 Core Features

### 1. Patient Care Report Form

Comprehensive form capturing:
- **Basic Information** - Date, location, call/report numbers
- **Patient Demographics** - Name, DOB, sex, status
- **Medical History** - Allergies, medications, conditions
- **Chief Complaint & Symptoms** - Detailed patient assessment
- **Treatment Performed** - Interventions and procedures
- **Vital Signs** - Time-series vital sign tracking
- **OPQRST Assessment** - Pain evaluation protocol
- **Transfer of Care** - Handoff documentation

### 2. Interactive Injury Canvas

- Visual body diagram for injury documentation
- Drawing tools for marking specific injury locations
- Annotation capabilities for detailed notes
- Export to PDF with injury visualization

### 3. Oxygen Protocol Tracking

- Protocol-compliant O2 therapy documentation
- SpO2 target range configuration (COPD/Other)
- Flow rate alteration tracking
- Therapy start/end times with reasons

### 4. Draft Management

- Automatic draft saving every 30 seconds
- Resume incomplete reports from dashboard
- 24-hour draft retention with automatic cleanup
- Conflict resolution for concurrent edits

### 5. User Management

- Role-based access control (Admin/User)
- User creation and modification
- Activity logging for audit trails
- Session management with timeout warnings

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt with salt rounds
- **Input Validation** - Joi schemas for all API endpoints
- **XSS Protection** - Sanitized user inputs
- **CORS Configuration** - Controlled cross-origin access
- **Rate Limiting** - API request throttling
- **Helmet.js** - Security headers middleware
- **Activity Logging** - Complete audit trail

## 🗄️ Database Schema

The application uses SQLite with the following main tables:

- **users** - User accounts and authentication
- **pcr_reports** - Completed patient care reports
- **drafts** - Auto-saved draft reports
- **activity_logs** - System activity audit trail

## 🖥️ Desktop Application

Built with Electron for cross-platform deployment:

- **Windows** - NSIS installer with Start Menu integration
- **macOS** - DMG with code signing and notarization support
- **Linux** - AppImage and DEB packages

### Building Desktop Apps

```bash
# Current platform
npm run package

# Specific platforms
npm run package:win
npm run package:mac
npm run package:linux

# With code signing
npm run sign-and-notarize
```

## 🌐 API Documentation

### Authentication Endpoints

```
POST /api/auth/login    - User login
POST /api/auth/logout   - User logout
GET  /api/auth/check    - Verify authentication
```

### PCR Endpoints

```
GET    /api/pcr         - List all reports
GET    /api/pcr/:id     - Get specific report
POST   /api/pcr         - Create new report
PUT    /api/pcr/:id     - Update report
DELETE /api/pcr/:id     - Delete report
POST   /api/pcr/draft   - Save draft
GET    /api/pcr/drafts  - List user drafts
```

### User Management

```
GET    /api/users       - List all users (admin)
POST   /api/users       - Create user (admin)
PUT    /api/users/:id   - Update user (admin)
DELETE /api/users/:id   - Delete user (admin)
```

### Activity Logs

```
GET    /api/logs        - Get activity logs (admin)
```

## 🧪 Testing

The application includes comprehensive testing:

- **Unit Tests** - Jest with ts-jest for components and services
- **Integration Tests** - API endpoint testing with Supertest
- **E2E Tests** - Playwright for user workflow testing
- **Coverage Reports** - Generated in `/coverage` directory

Run tests:
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
npm run test:e2e          # E2E tests
```

## 🚢 Deployment

### Production Build

```bash
# Build for production
npm run build

# Serve with PM2 (recommended)
pm2 start src/backend/dist/index.js --name pcr-backend
pm2 serve dist 5173 --name pcr-frontend
```

### Docker Deployment

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000 5173
CMD ["npm", "start"]
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database
DATABASE_PATH=./pcr_database.db

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# Frontend URL
CLIENT_URL=http://localhost:5173

# Logging
LOG_LEVEL=info
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Built with ❤️ for Emergency Medical Services**
