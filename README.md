# PCR Frontend Application

A professional, user-friendly React frontend for the Patient Care Report (PCR) application built with modern web technologies.

## 🏗️ Architecture

### Technology Stack
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe JavaScript with excellent developer experience
- **Vite** - Fast build tool with HMR (Hot Module Replacement)
- **Tailwind CSS** - Utility-first CSS framework with custom healthcare theme
- **React Router** - Client-side routing with protected routes
- **React Hook Form** - Performant forms with easy validation
- **Fabric.js** - Canvas library for injury diagram drawing
- **Lucide React** - Beautiful, customizable icons

### Component Architecture
```
src/frontend/
├── components/
│   ├── ui/           # Reusable UI components (Button, Card, Modal, etc.)
│   ├── forms/        # Form components (Input, Select, Checkbox, etc.)
│   ├── layout/       # Layout components (Header, Sidebar, Footer)
│   └── composite/    # Complex components (VitalSignsTable, InjuryCanvas)
├── pages/            # Page components
├── context/          # React Context providers
├── hooks/            # Custom React hooks
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
└── styles/           # Global styles and Tailwind config
```

## 🎯 Features

### Core Features
- **Authentication System** - Secure login with role-based access
- **Comprehensive PCR Form** - All fields from `form_inputs.md` specification
- **Real-time Validation** - Client-side form validation with error handling
- **Auto-save** - Automatic draft saving every 30 seconds
- **Dark Mode** - Full dark mode support with theme persistence
- **Responsive Design** - Mobile-first design that works on all devices
- **Accessibility** - WCAG 2.1 AA compliant with ARIA labels and keyboard navigation

### Advanced Features
- **Injury Canvas** - Interactive body diagram for marking injuries
- **Vital Signs Tables** - Editable tables with time tracking
- **Oxygen Protocol** - Specialized form for oxygen therapy documentation
- **Session Management** - Automatic timeout with warnings
- **Progress Tracking** - Visual indicators for form completion
- **Print Support** - Print-optimized layouts for reports

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Demo Credentials
- **Admin**: username: `admin`, password: `admin`
- **User**: username: `user`, password: `user`

## 🎨 Design System

### Color Palette
- **Primary**: Medical blue (#0ea5e9) - Professional and trustworthy
- **Medical**: Lighter blue (#0284c7) - Healthcare-specific actions
- **Emergency**: Red (#ef4444) - Urgent/critical information
- **Success**: Green (#10b981) - Positive actions and confirmations

### Typography
- **Primary**: Inter - Clean, professional sans-serif
- **Medical**: Roboto - Alternative for medical contexts

## 📱 Responsive Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

## 🔧 Development

### Project Structure
The application follows a modular architecture with clear separation of concerns:

#### Components
- **UI Components**: Reusable, unstyled components that can be themed
- **Form Components**: Specialized form inputs with validation
- **Layout Components**: App shell and navigation components
- **Composite Components**: Complex, domain-specific components

#### State Management
- **React Context**: Global state for auth, notifications, and form data
- **Custom Hooks**: Reusable stateful logic (useAutosave, useTimeout)
- **Local State**: Component-specific state using useState/useReducer

#### Routing
- **Protected Routes**: Authentication-required pages
- **Lazy Loading**: Code-splitting for better performance
- **Breadcrumb Navigation**: Clear navigation hierarchy

### Key Patterns

#### Form Handling
```typescript
// Uses React Context for form state management
const { data, updateField, errors, isDirty } = useForm()

// Auto-save functionality
const { loadDraft, clearDraft } = useAutosave({
  key: 'pcr-form',
  data: formData,
  interval: 30000
})
```

#### Component Composition
```typescript
// Compound component pattern
<Card>
  <Card.Header title="Patient Information" />
  <Card.Body>
    <FormSection title="Basic Info">
      <Input label="Name" />
    </FormSection>
  </Card.Body>
</Card>
```

## 🧪 Testing

### Test Setup
- **Vitest** - Fast unit test runner
- **React Testing Library** - Component testing utilities
- **Jest DOM** - Custom matchers for DOM testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📦 Build & Deployment

### Build Process
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Production build
npm run build
```

### Production Optimizations
- **Code Splitting** - Lazy-loaded routes and components
- **Tree Shaking** - Dead code elimination
- **Asset Optimization** - Minified CSS/JS with gzip compression
- **Progressive Web App** - Service worker for offline functionality

## 🔒 Security Features

### Authentication
- JWT token storage with expiration
- Protected routes with automatic redirection
- Session timeout with warnings
- Secure logout with token cleanup

### Data Protection
- Input sanitization to prevent XSS
- CSRF protection headers
- Secure local storage handling
- Form validation on both client and server

## 🎯 Form Implementation

### PCR Form Features
Based on `form_inputs.md`, the form includes:

- **Basic Information** (13 fields) - Call details and response times
- **Patient Information** (10+ fields) - Demographics and contacts  
- **Medical History** (7 fields) - Clinical assessment data
- **Treatment Performed** (10+ fields) - Interventions and procedures
- **OPQRST Assessment** (6 fields) - Pain/symptom evaluation
- **Injury Canvas** - Interactive body diagram
- **Vital Signs Tables** - Two separate tables with 6 rows each
- **Oxygen Protocol** - Comprehensive oxygen therapy documentation
- **Additional Information** (4 fields) - Transfer and completion details

### Form Validation
- **Required Fields**: 15+ required fields clearly marked
- **Format Validation**: Time (HH:MM), dates, numbers
- **Real-time Feedback**: Instant validation with error messages
- **Progress Tracking**: Visual completion indicators

## 📋 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm test             # Run tests
```

## 🤝 Contributing

### Code Style
- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for complex functions
- Ensure accessibility compliance
- Write tests for new components

### Git Workflow
1. Create feature branch from `main`
2. Make changes with descriptive commits
3. Ensure tests pass and code is linted
4. Submit pull request with detailed description

## 📄 License

This project is proprietary healthcare software. All rights reserved.

## 🆘 Support

For technical support or feature requests, please contact the development team.

---

**Built with ❤️ for healthcare professionals**