# PCR Application - Patient Care Report System

A comprehensive desktop application for documenting patient care reports, built with Electron, React, TypeScript, and SQLite. Designed specifically for the Volunteer Crisis Response Team (VCRT) at the University of Ottawa.

## 🏗️ Architecture Overview

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- Fabric.js for interactive injury diagrams
- jsPDF for PDF report generation
- React Router for navigation

**Backend:**
- Express.js with TypeScript
- SQLite (better-sqlite3) for data storage
- JWT authentication
- Automatic cleanup service for old records

**Desktop:**
- Electron 32 for cross-platform desktop app
- Dynamic port allocation for backend server
- IPC communication for file dialogs and system integration
- Automatic database management in user data directory

### Project Structure

```
PCR/
├── src/
│   ├── frontend/              # React frontend application
│   │   ├── components/
│   │   │   ├── ui/           # Reusable UI components
│   │   │   ├── forms/        # Form input components
│   │   │   ├── layout/       # Header, Sidebar, etc.
│   │   │   └── composite/    # Complex components (Canvas, Tables)
│   │   ├── pages/            # Page components
│   │   ├── context/          # React Context providers
│   │   ├── services/         # API and PDF services
│   │   ├── utils/            # Utility functions
│   │   └── public/images/    # Static assets
│   ├── backend/              # Express backend API
│   │   └── src/
│   │       ├── routes/       # API route handlers
│   │       ├── services/     # Business logic
│   │       ├── middleware/   # Express middleware
│   │       └── database/     # SQLite database setup
│   └── shared/               # Shared TypeScript types
├── electron/                 # Electron main and preload scripts
├── dist/                     # Built application files
└── release/                  # Packaged Electron apps
```

## 🎯 Key Features

### Patient Care Reporting
- **Comprehensive PCR Form**: Captures all essential patient care information
- **Auto-save Drafts**: Automatically saves form progress every 30 seconds
- **Real-time Validation**: Client-side validation with helpful error messages
- **PDF Generation**: Creates professional PDF reports with logos and formatted data
- **Print Workflow**: Integrated print confirmation before submission

### Interactive Components
- **Injury Canvas**: Draw and annotate injuries on body diagrams
- **Vital Signs Tables**: Track multiple vital sign measurements over time
- **Oxygen Protocol**: Detailed oxygen therapy administration tracking
- **OPQRST Assessment**: Structured pain and symptom evaluation

### User Management
- **Role-based Access**: Admin and user roles with different permissions
- **Authentication**: Secure JWT-based login system
- **Activity Logs**: Complete audit trail of all system actions (admin only)
- **User CRUD**: Create, update, deactivate users (admin only)

### Desktop Integration
- **Native Application**: Runs as a desktop app on Windows, macOS, and Linux
- **Offline Capable**: All data stored locally in SQLite database
- **File Dialogs**: Native save/open dialogs for data export
- **System Tray**: Optional system tray integration

## 🚀 Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd PCR

# Install dependencies
npm install

# Create initial admin and user accounts
npm run create-accounts
```

### Development

```bash
# Start frontend development server (Vite on port 5173)
npm run frontend:dev

# Start backend development server (Express on port 3000)
npm run backend:dev

# Run full development stack (both frontend and backend)
npm run dev

# Start Electron in development mode
npm run electron:dev
```

### Building

```bash
# Build frontend
npm run frontend:build

# Build backend
npm run backend:build

# Build both frontend and backend
npm run build

# Build Electron app
npm run electron:build

# Package Electron app for current platform
npm run electron:package:mac     # macOS
npm run electron:package:win     # Windows
npm run electron:package:linux   # Linux
```

### Default Credentials

After running `npm run create-accounts`:
- **Admin**: username: `admin`, password: `admin`
- **User**: username: `user`, password: `user`

**⚠️ Change these passwords in production!**

## 💾 Database

### Location
- **Development**: `src/backend/pcr_database.db`
- **Electron Production**: `~/Library/Application Support/PCR Application/pcr_database.db` (macOS)

### Schema
- **users**: User accounts with authentication
- **pcr_reports**: Patient care reports (drafts and submitted)
- **activity_logs**: Audit trail of system actions

### Cleanup Service
- Automatically runs daily at midnight
- Removes submitted reports older than 24 hours
- Configurable retention period in `src/backend/src/services/cleanup.ts`

## 🔒 Security Features

### Authentication
- JWT tokens with 24-hour expiration
- Secure password hashing with bcrypt
- Role-based access control (admin/user)
- Protected API routes with middleware

### Data Protection
- SQL injection prevention via parameterized queries
- Input validation on both client and server
- XSS protection with content sanitization
- CORS configuration for web access

### Activity Logging
- All user actions logged with timestamps
- IP address tracking
- Request/response details for audit trail

## 📋 Form Specification

The PCR form implements all fields from `form_inputs.md`:

### Required Sections
1. **Basic Information** (13 fields)
   - Date, location, call/report numbers
   - Supervisor, responders, times

2. **Patient Information** (10+ fields)
   - Name, DOB, age, sex, status
   - Emergency contact details

3. **Medical History** (7 fields)
   - Chief complaint, signs/symptoms
   - Allergies, medications, medical history

4. **Treatment Performed** (10+ fields)
   - Airway management, hemorrhage control
   - CPR/AED, immobilization, patient position

5. **OPQRST Assessment** (6 fields)
   - Onset, provocation, quality, radiation, scale, time

6. **Vital Signs** (2 tables)
   - Table 1: Time, pulse, resp, BP, LOC/GCS, skin/temp, pupils
   - Table 2: Time, SpO2 readings

7. **Oxygen Protocol**
   - Saturation assessment, therapy decision
   - Flow rate alterations, therapy end details

8. **Additional Information** (4 fields)
   - Call description, patient transfer details
   - Transfer comments, time transferred

## 🎨 UI/UX Features

### Design System
- **Healthcare Theme**: Professional blue color palette
- **Dark Mode**: Full dark mode support with theme persistence
- **Responsive**: Works on desktop, tablet, and mobile
- **Accessibility**: WCAG 2.1 AA compliant with ARIA labels

### User Experience
- **Progressive Disclosure**: Complex forms broken into manageable sections
- **Visual Feedback**: Loading states, success/error notifications
- **Keyboard Navigation**: Full keyboard support for efficiency
- **Auto-complete**: Time pickers with quick time entry
- **Contextual Help**: Placeholder text and field descriptions

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### PCR Reports
- `GET /api/pcr` - List all reports
- `GET /api/pcr/:id` - Get specific report
- `POST /api/pcr` - Create draft
- `PUT /api/pcr/:id` - Update report
- `DELETE /api/pcr/:id` - Delete report
- `POST /api/submissions` - Submit final report

### User Management (Admin Only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Activity Logs (Admin Only)
- `GET /api/logs` - Get activity logs with filters

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Prepare for release (lint + type-check + test + audit)
npm run prepare-release
```

## 📦 Deployment

### Building for Production

```bash
# Build everything
npm run build

# Package for macOS
npm run electron:package:mac

# Package for Windows
npm run electron:package:win

# Package for Linux
npm run electron:package:linux
```

### Distributable Artifacts
- **macOS**: `.dmg` and `.zip` in `release/`
- **Windows**: `.exe` installer in `release/`
- **Linux**: `.AppImage` in `release/`

## 🛠️ Development Tips

### Electron Development
- Backend runs on a random available port (dynamic allocation)
- Port communicated to frontend via IPC
- DevTools enabled in development mode
- Database stored in user's application data directory

### Hot Reload
- Frontend: Vite provides instant HMR
- Backend: Use `nodemon` for auto-restart
- Electron: Restart required for main process changes

### Debugging
- Frontend: Browser DevTools (Chrome DevTools in Electron)
- Backend: Node.js debugger with `--inspect` flag
- Electron: Main process logs to terminal, renderer to DevTools

### Common Issues

**White screen in Electron:**
- Check DevTools console for JavaScript errors
- Verify all asset paths use relative paths (`./images/...`)
- Ensure `base: './'` in `vite.config.ts`

**API calls failing:**
- Check backend is running and accessible
- Verify JWT token in localStorage
- Check CORS configuration for web development

**Database locked errors:**
- Close any other connections to the database
- Use better-sqlite3 (not sqlite3) for synchronous operations
- Ensure cleanup service isn't conflicting

## 📄 Scripts Reference

### Development
- `npm run dev` - Start full dev environment
- `npm run frontend:dev` - Frontend only (Vite)
- `npm run backend:dev` - Backend only (ts-node)
- `npm run electron:dev` - Electron in dev mode

### Building
- `npm run build` - Build frontend + backend
- `npm run frontend:build` - Build frontend (Vite)
- `npm run backend:build` - Build backend (TypeScript)
- `npm run electron:build` - Build Electron (TypeScript)

### Packaging
- `npm run electron:package:mac` - Package for macOS
- `npm run electron:package:win` - Package for Windows
- `npm run electron:package:linux` - Package for Linux

### Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run type-check` - TypeScript checking
- `npm run format` - Format with Prettier
- `npm run prepare-release` - Pre-release checks

### Database
- `npm run create-accounts` - Create admin/user accounts

## 🤝 Contributing

### Code Style
- TypeScript for all code
- ESLint + Prettier for formatting
- Conventional commit messages
- Component-driven development

### Pull Request Process
1. Create feature branch from `main`
2. Make changes with clear commit messages
3. Run `npm run prepare-release` before committing
4. Submit PR with description of changes
5. Ensure all checks pass

## 📝 License

This project is proprietary healthcare software for the University of Ottawa VCRT.
All rights reserved.

## 🆘 Support

For issues, questions, or feature requests:
- Check existing documentation in `/docs`
- Review `CLAUDE.md` for development guidelines
- Contact the development team

---

**Built with ❤️ for healthcare professionals**
