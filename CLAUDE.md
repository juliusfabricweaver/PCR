# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Development Server
- `npm run dev` - Start both frontend (Vite dev server on port 5173) and backend (nodemon on port 3000) concurrently
- `npm run frontend:dev` - Start only frontend development server
- `npm run backend:dev` - Start only backend development server with hot reload

### Building
- `npm run build` - Build both frontend and backend for production
- `npm run frontend:build` - Build frontend only (outputs to dist/frontend)
- `npm run backend:build` - Build backend only (outputs to dist/backend)

### Testing
- `npm test` - Run Jest unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run test:e2e` - Run Playwright end-to-end tests

### Code Quality
- `npm run lint` - Run ESLint with TypeScript rules
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting without fixing
- `npm run type-check` - Run TypeScript type checking without emitting files

### NW.js Desktop App
- `npm run nw` - Run the app in NW.js desktop environment
- `npm run nw:dev` - Build and run in NW.js for development
- `npm run package` - Package app for current platform
- `npm run package:all` - Package for Windows, macOS, and Linux
- `npm run release` - Full release build including installers and code signing

### Database
- `npm run create-accounts` - Run script to create initial user accounts

## Architecture Overview

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript + SQLite3
- **Desktop Runtime**: NW.js (Chromium + Node.js)
- **Canvas Drawing**: Fabric.js for injury diagrams
- **PDF Generation**: jsPDF for report generation
- **Database**: Better-SQLite3 for local data storage

### Project Structure
```
src/
├── frontend/           # React frontend application
│   ├── components/     # Reusable UI components
│   │   ├── ui/        # Basic UI primitives (Button, Card, Modal)
│   │   ├── forms/     # Form components (Input, Select, etc.)
│   │   ├── layout/    # Layout components (Header, Footer)
│   │   └── composite/ # Complex components (VitalSignsTable, InjuryCanvas)
│   ├── pages/         # Page components
│   ├── context/       # React Context providers (Auth, Form, Notification)
│   ├── hooks/         # Custom React hooks
│   ├── services/      # API and utility services
│   └── utils/         # Utility functions
├── backend/           # Express.js backend
│   └── src/
│       ├── controllers/ # Route handlers
│       ├── middleware/  # Express middleware
│       ├── routes/      # Route definitions
│       ├── services/    # Business logic services
│       ├── database/    # Database setup and migrations
│       └── utils/       # Backend utilities
└── shared/            # Shared types and utilities
    ├── types/         # TypeScript type definitions
    ├── constants/     # Shared constants
    └── utils/         # Shared utility functions
```

### Path Aliases
The project uses TypeScript path mapping:
- `@/*` → `src/*`
- `@/components/*` → `src/frontend/components/*`
- `@/pages/*` → `src/frontend/pages/*`
- `@/hooks/*` → `src/frontend/hooks/*`
- `@/utils/*` → `src/frontend/utils/*`
- `@/types/*` → `src/shared/types/*`
- `@/shared/*` → `src/shared/*`
- `@/backend/*` → `src/backend/*`

### Key Components

#### Frontend Architecture
- **Context Providers**: AuthContext, FormContext, NotificationContext manage global state
- **Custom Hooks**: useAuth, useAutosave, useSessionTimeout provide reusable logic
- **Form Components**: Built with React Hook Form for validation and performance
- **Composite Components**: 
  - `InjuryCanvas` - Interactive body diagram using Fabric.js
  - `VitalSignsTable` - Editable table for vital sign measurements
  - `OxygenProtocolForm` - Specialized oxygen therapy documentation

#### Backend Architecture
- **Database**: SQLite with better-sqlite3 for synchronous operations
- **Authentication**: JWT-based with bcrypt password hashing
- **Encryption**: AES encryption for draft data storage
- **Logging**: Winston logger with structured logging
- **API Structure**: RESTful endpoints with validation middleware

### Database Schema
Key tables:
- `users` - User accounts with role-based access
- `submissions` - Completed PCR form submissions
- `drafts` - Auto-saved encrypted draft data
- `logs` - System activity logging

### Form Implementation
The PCR form is based on `form_inputs.md` specification with:
- **80+ form fields** across multiple sections
- **Real-time validation** with error display
- **Auto-save functionality** every 30 seconds
- **Session timeout** with warnings
- **Interactive injury diagram** for marking body injuries
- **Vital signs tables** with time-stamped measurements

### Code Style
- **ESLint**: TypeScript-focused rules with React plugins
- **Prettier**: Consistent code formatting
- **TypeScript**: Strict mode enabled with path mapping
- **Indentation**: 2 spaces, no semicolons, single quotes
- **Imports**: No unused imports, prefer arrow functions

### Development Notes
- Frontend dev server proxies API calls to backend on port 3000
- NW.js configuration allows Node.js APIs in the renderer process
- Database migrations run automatically on backend startup
- Hot reloading enabled for both frontend and backend during development
- Tests use Jest for unit testing and Playwright for E2E testing

### Starting the Server
**IMPORTANT**: The backend requires Node.js 18 due to better-sqlite3 compatibility.

To start the backend server correctly:
```bash
npx ts-node --transpile-only src/backend/src/index.ts
```

Or use the npm script (which handles Node version automatically):
```bash
npm run backend:dev
```

### Adding Frontend Features

#### Key Patterns to Follow:

1. **Authentication Integration**
   - Always use `useAuth()` hook from `@/context/AuthContext`
   - Check `isAuthenticated` and `token` before API calls
   - Example:
   ```typescript
   const { token, isAuthenticated, user } = useAuth()

   if (!isAuthenticated || !token) {
     setError('Please log in to access this feature')
     return
   }
   ```

2. **API Calls**
   - Always include Authorization header: `Bearer ${token}`
   - Handle errors properly with user-friendly messages
   - Example:
   ```typescript
   const response = await fetch('/api/endpoint', {
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json',
     },
   })
   ```

3. **Role-Based Access**
   - For admin-only features, check `user?.role === 'admin'`
   - Hide navigation items conditionally based on role
   - Backend routes are protected with `requireRole(['admin'])` middleware

4. **UI Components**
   - Use existing components from `@/components/ui` and `@/components/forms`
   - Follow existing patterns: Button, Modal, Input, Select, Alert, Loading
   - Maintain consistent styling with existing pages

5. **Form Handling**
   - Use controlled components with useState for form data
   - Implement proper validation with error display
   - Show loading states during API operations
   - Example pattern:
   ```typescript
   const [formData, setFormData] = useState({ field1: '', field2: '' })
   const [errors, setErrors] = useState({})
   const [loading, setLoading] = useState(false)
   ```

6. **Table Layouts**
   - Use `overflow-x-auto` for horizontal scrolling
   - Add minimum widths to columns: `min-w-[200px]`
   - Use flex layouts for action buttons: `flex items-center justify-end gap-2`

7. **Navigation Updates**
   - Add new routes to `src/frontend/App.tsx`
   - Update `src/frontend/components/layout/Sidebar.tsx` for menu items
   - Pass user role to Sidebar for conditional rendering

#### File Structure for New Features:
- Page components: `src/frontend/pages/FeaturePage.tsx`
- Add route in: `src/frontend/App.tsx`
- Backend API: `src/backend/src/routes/feature.ts`
- Types: `src/shared/types/index.ts`

#### Common Issues to Avoid:
- Never use direct localStorage access for tokens (use useAuth hook)
- Don't forget to handle loading and error states
- Remember to refresh data after create/update operations
- Always validate user permissions before showing admin features
- Use proper TypeScript interfaces for form data and API responses

### Security Features
- Password hashing with bcrypt
- JWT token-based authentication
- AES encryption for draft storage
- Input validation and sanitization
- Session timeout management
- Role-based access control (admin/user roles)
