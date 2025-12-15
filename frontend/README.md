# Employee Management System

A modern, production-ready React.js application built with Vite and Tailwind CSS for managing employee data. This application is based on SquareShift's Employee Management System wireframes and implements comprehensive CRUD operations, search, filtering, and a responsive design.

## 🚀 Features

### Core Functionality
- **Authentication**: Google Workspace SSO simulation
- **Dashboard**: Overview of employee statistics and quick actions
- **Employee Directory**: Searchable and filterable employee list
- **Employee Profiles**: Detailed employee information pages
- **CRUD Operations**: Create, Read, Update, and soft-delete employees
- **Responsive Design**: Mobile-first, works on all device sizes

### Advanced Features
- **Real-time Search**: Instant search across multiple employee fields
- **Advanced Filtering**: Filter by department, location, and role
- **Sorting**: Sort by name, title, department, etc.
- **Data Validation**: Form validation with error handling
- **State Management**: React Context for global state
- **Routing**: Protected routes with authentication checks
- **Modern UI**: Clean, professional design with animations

## 🛠 Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and development server
- **React Router Dom** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixes

## 📦 Installation & Setup

### Prerequisites
- Node.js 16+ and npm/yarn
- Modern web browser

### Step 1: Install Dependencies
```bash
cd Employee_App/development/frontend
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Step 3: Build for Production
```bash
npm run build
```

### Step 4: Preview Production Build
```bash
npm run preview
```

## 🏗 Project Structure

```
frontend/
├── public/
│   └── index.html          # HTML template
├── src/
│   ├── components/         # Reusable React components
│   │   ├── Header.jsx      # Navigation header
│   │   └── ProtectedRoute.jsx # Route protection
│   ├── pages/              # Page-level components
│   │   ├── Login.jsx       # Authentication page
│   │   ├── Dashboard.jsx   # Dashboard overview
│   │   ├── EmployeeDirectory.jsx # Employee list
│   │   ├── EmployeeDetail.jsx    # Employee profile
│   │   ├── CreateEmployee.jsx    # Add new employee
│   │   └── EditEmployee.jsx      # Edit employee
│   ├── context/            # React Context providers
│   │   ├── AuthContext.jsx # Authentication state
│   │   └── EmployeeContext.jsx # Employee data state
│   ├── styles/             # CSS and styling
│   │   └── index.css       # Global styles + Tailwind
│   ├── App.jsx             # Main application component
│   └── main.jsx            # Application entry point
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
└── eslint.config.js        # ESLint configuration
```

## 🎯 Usage Guide

### Authentication
1. Click "Sign in with Google Workspace" on the login page
2. The app simulates OAuth authentication (no real Google account needed)
3. You'll be redirected to the dashboard upon successful login

### Dashboard
- View employee statistics and department overview
- Use quick action buttons for common tasks
- Access recent activity notifications

### Employee Management
- **View All Employees**: Navigate to Directory to see all employees
- **Search**: Use the search bar to find employees by name, email, ID, or department
- **Filter**: Apply filters by location, department, and role
- **Sort**: Click column headers to sort data
- **View Details**: Click employee names to view detailed profiles
- **Add Employee**: Use "Add Employee" button to create new records
- **Edit Employee**: Click the edit button on employee detail pages
- **Deactivate**: Use the deactivate button to soft-delete employees

### Employee Profiles
- Contact information and job details
- Skills and certifications (if available)
- Direct reports and team structure
- Easy navigation to edit or manage employees

## 🎨 Design System

### Color Palette
- **Primary**: Blue (#3B82F6) - Actions, links, primary buttons
- **Success**: Emerald (#10B981) - Success states, active status
- **Warning**: Amber (#F59E0B) - Warnings, pending states
- **Danger**: Red (#EF4444) - Errors, delete actions
- **Neutral**: Slate (#64748B) - Text, borders, backgrounds

### Typography
- **Font Family**: Poppins (Google Fonts)
- **Weights**: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Component Classes
- **Buttons**: `.btn-primary`, `.btn-secondary`
- **Forms**: `.input-field`, `.select-field`
- **Cards**: `.card`, `.card-header`
- **Avatars**: `.avatar`, `.avatar-sm`, `.avatar-md`, `.avatar-lg`
- **Status**: `.status-badge`, `.status-active`, `.status-inactive`

## 📊 Data Structure

### Employee Model
```javascript
{
  id: 'EMP001',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@company.com',
  phone: '+1 (555) 123-4567',
  title: 'Senior Engineer',
  department: 'Engineering',
  location: 'New York',
  manager: 'John Smith',
  hireDate: '2021-03-15',
  salary: '$120,000',
  status: 'Active',
  address: '123 Main St, New York, NY 10001',
  dateOfBirth: '1990-05-15',
  employmentType: 'Full-time',
  avatar: 'JD',
  skills: ['JavaScript', 'React', 'Node.js'],
  certifications: [...],
  directReports: [...]
}
```

## 🔐 Security Features

- **Authentication**: Simulated OAuth 2.0 flow
- **Route Protection**: Protected routes require authentication
- **Session Management**: Secure session handling with localStorage
- **Form Validation**: Client-side validation with error handling
- **Data Sanitization**: Input sanitization and validation

## 🚀 Production Deployment

### Environment Variables
Create a `.env` file for production:
```env
VITE_APP_TITLE=Employee Management System
VITE_API_URL=your-api-endpoint
```

### Build Optimization
- Tree shaking and code splitting
- CSS optimization and purging
- Asset compression and caching
- Modern JavaScript output

### Deployment Options
- **Vercel**: `npm run build` + Vercel deployment
- **Netlify**: `npm run build` + Netlify deployment
- **Static Hosting**: Deploy `dist/` folder to any static host

## 🧪 Testing

### Available Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🔄 Future Enhancements

### Phase 2 Features (Planned)
- **Bulk Import**: Excel/CSV file upload and processing
- **Advanced Reporting**: Analytics and reporting dashboard
- **Team Management**: Org chart and team visualization
- **API Integration**: Backend API connectivity
- **Real-time Updates**: WebSocket integration for live updates
- **Advanced Search**: Full-text search with filters
- **Export Functionality**: PDF and Excel export options

### Technical Improvements
- **Unit Testing**: Jest and React Testing Library
- **E2E Testing**: Cypress integration
- **Performance Monitoring**: Web Vitals tracking
- **Accessibility**: Enhanced a11y compliance
- **Internationalization**: Multi-language support

## 🤝 Contributing

This is a production-ready application based on SquareShift's specifications. The codebase follows modern React patterns and best practices:

- **Clean Architecture**: Separation of concerns
- **Reusable Components**: DRY principles
- **TypeScript Ready**: Easy migration to TypeScript
- **Performance Optimized**: Lazy loading and code splitting ready
- **Maintainable**: Clear documentation and naming conventions

## 📄 License

This project is developed for SquareShift's Employee Management System requirements.

---

**Built with ❤️ using React, Vite, and Tailwind CSS**
