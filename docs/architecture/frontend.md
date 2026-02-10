# Frontend Architecture

The S4 frontend is a modern React application with TypeScript, PatternFly 6 UI components, and React Router 7 for navigation.

## Technology Stack

- **Framework**: React 18
- **UI Library**: PatternFly 6
- **Language**: TypeScript
- **Routing**: React Router 7
- **HTTP Client**: Axios
- **Build Tool**: Webpack 5
- **State Management**: React Context + useState
- **Testing**: Jest + React Testing Library

## Architecture Principles

### 1. Component-Based Architecture

**Pattern**: Functional components with hooks for state and side effects.

```typescript
import React from 'react';
import { useModal } from '@app/hooks';
import { notifySuccess, notifyError } from '@app/utils/notifications';

const MyComponent: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const modal = useModal();

  const handleAction = async () => {
    setLoading(true);
    try {
      // API call
      notifySuccess('Success', 'Operation completed');
    } catch (error) {
      notifyError('Error', 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button onClick={modal.open}>Open Modal</Button>
      <Modal isOpen={modal.isOpen} onClose={modal.close}>
        {/* Modal content */}
      </Modal>
    </div>
  );
};
```

### 2. PatternFly 6 Design System

**Critical Requirements**:

- ALWAYS use `pf-v6-` class prefix
- Use semantic design tokens (`--pf-t--*`) only
- Never hardcode colors or spacing values
- Test in both light and dark themes

**Component Import Pattern**:

```typescript
import { Button, Card, Page, PageSection } from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { TrashIcon, UploadIcon } from '@patternfly/react-icons';
```

**Design Token Usage**:

```css
/* ✅ CORRECT - Semantic token */
.my-element {
  color: var(--pf-t--global--color--brand--default);
  padding: var(--pf-t--global--spacer--md);
}

/* ❌ WRONG - Hardcoded value */
.my-element {
  color: #0066cc;
  padding: 16px;
}
```

### 3. State Management Philosophy

**Local State First**:

- Use `useState` for component-specific state
- Prefer component-level state over global state

**Context for Global State**:

- `AuthContext` for authentication state
- No Redux (folder exists but not actively used)

**EventEmitter for Cross-Component Communication**:

- Notifications (success, error, warning, info)
- Upload progress updates
- Authentication state changes

**Reusable Hooks**:

- `useModal()` - Modal state management
- `useStorageLocations()` - Storage location loading

### 4. API Integration Pattern

**Centralized Axios Instance**:

```typescript
// src/app/utils/apiClient.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Automatically include JWT token
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (token expired)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Emitter.emit('auth:unauthorized');
    }
    return Promise.reject(error);
  },
);
```

**Usage in Components**:

```typescript
import apiClient from '@app/utils/apiClient';

const response = await apiClient.get('/buckets');
const buckets = response.data.buckets;
```

### 5. Error Handling Pattern

**Notification System**:

```typescript
import { notifySuccess, notifyError, notifyApiError } from '@app/utils/notifications';

try {
  await apiClient.post('/buckets', { bucketName });
  notifySuccess('Bucket created', `Bucket ${bucketName} created successfully`);
} catch (error) {
  notifyApiError('Create bucket', error);
}
```

**Features**:

- Extracts error messages from Axios responses
- Logs errors to console for debugging
- Shows user-friendly toast notifications
- Centralized error handling logic

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── components/          # React components
│   │   │   ├── AppLayout.tsx           # Main layout with navigation
│   │   │   ├── AuthContext.tsx         # Auth state management
│   │   │   ├── AuthGate.tsx            # Route protection wrapper
│   │   │   ├── Login.tsx               # Login form
│   │   │   ├── StorageBrowser.tsx      # Unified file browser
│   │   │   ├── Buckets.tsx             # Bucket management
│   │   │   ├── Settings.tsx            # Configuration UI
│   │   │   ├── DocumentRenderer.tsx    # Markdown viewer
│   │   │   └── NotFound.tsx            # 404 page
│   │   │
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── useModal.ts             # Modal state management
│   │   │   └── useStorageLocations.ts  # Storage location loading
│   │   │
│   │   ├── utils/               # Utilities
│   │   │   ├── apiClient.ts            # Axios instance with auth
│   │   │   ├── EventEmitter.ts         # Cross-component events
│   │   │   ├── notifications.ts        # Notification helpers
│   │   │   ├── validation.ts           # S3 name validation
│   │   │   └── sseTickets.ts           # SSE ticket utilities
│   │   │
│   │   ├── services/            # Service layer
│   │   │   └── storageService.ts       # Unified storage API
│   │   │
│   │   ├── routes.tsx           # Route definitions
│   │   ├── config.tsx           # App configuration
│   │   ├── app.css              # Global styles
│   │   └── index.tsx            # App component
│   │
│   ├── i18n/                    # Internationalization
│   ├── redux/                   # Redux (not actively used)
│   └── index.tsx                # Entry point
│
├── dist/                        # Webpack build output
├── webpack.common.js            # Base config
├── webpack.dev.js               # Development config
└── webpack.prod.js              # Production config
```

## Key Components

### AppLayout

**Responsibility**: Main application layout with navigation sidebar.

**Features**:

- Responsive sidebar navigation
- Theme switcher (light/dark)
- Logout button (when authenticated)
- Toast notification system

**Integration**:

```typescript
Emitter.on('notification', ({ variant, title, description }) => {
  setAlerts((prev) => [...prev, { variant, title, description, key: Date.now() }]);
});
```

### AuthContext

**Responsibility**: Global authentication state management.

**State**:

- `isAuthenticated` - Whether user is logged in
- `user` - Current user info (username, roles)
- `authRequired` - Whether authentication is enabled
- `loading` - Loading state during auth check

**Methods**:

- `login(username, password)` - Authenticate user
- `logout()` - Clear authentication state
- `checkAuth()` - Validate existing token

### StorageBrowser

**Responsibility**: Unified file browser for S3 buckets and local storage.

**Features**:

- File and folder listing with pagination
- Upload (drag & drop, file picker, folder upload)
- Download (single file, multiple files as zip)
- Delete (single file, folder with confirmation)
- Transfer between S3 and local storage
- Search and filtering
- Real-time upload progress via SSE

**Key Interactions**:

```typescript
// Upload with progress tracking
const handleUpload = async (files) => {
  for (const file of files) {
    const eventSource = await createAuthenticatedEventSource(encodedKey, 'upload');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      updateProgress(data.loaded, data.total);
    };

    await apiClient.post(`/objects/upload/${bucketName}/${encodedKey}`, formData);
  }
};
```

### Buckets

**Responsibility**: S3 bucket management interface.

**Features**:

- List all accessible buckets
- Create new bucket with validation
- Delete bucket with confirmation
- Navigate to bucket contents

**Validation**:

```typescript
import { validateS3BucketName, getBucketNameRules } from '@app/utils/validation';

const handleCreate = () => {
  if (!validateS3BucketName(bucketName, existingBuckets)) {
    notifyError('Invalid bucket name', 'Please check bucket naming rules');
    return;
  }
  // Create bucket
};
```

### Settings

**Responsibility**: Configuration management interface.

**Sections**:

- S3 connection settings
- HuggingFace token configuration
- Proxy settings
- Performance tuning (concurrency, pagination)

**Features**:

- Test connections before saving
- Live validation feedback
- Secure credential handling

## Routing

### React Router 7 Integration

**Routes** (defined in `src/app/routes.tsx`):

- `/` - Redirect to storage browser
- `/login` - Login page (public)
- `/browse/:locationId?/:path?` - Storage browser (protected)
- `/buckets` - Bucket management (protected)
- `/settings` - Configuration (protected)
- `*` - 404 not found

**Route Protection**:

```typescript
const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authRequired, loading } = useAuth();

  if (loading) return <Spinner />;
  if (authRequired && !isAuthenticated) {
    return <Navigate to="/login" />;
  }
  return <>{children}</>;
};
```

### URL Encoding Strategy

**LocationId (NOT encoded)**:

- S3 bucket names: Validated to URL-safe `[a-z0-9-]`
- Local locations: Pattern `local-0`, `local-1` (always URL-safe)
- Benefit: Human-readable URLs like `/browse/my-bucket`

**Path (Base64-encoded)**:

- Contains slashes, spaces, special characters
- Example: `models/llama/config.json` → `bW9kZWxzL2xsYW1hL2NvbmZpZy5qc29u`
- Benefit: Handles all characters without URL encoding issues

**Encoding/Decoding**:

```typescript
// Frontend encoding
const encodedPath = btoa(path).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

// Backend decoding
const path = base64Decode(encodedPath);
```

## Authentication Flow

### Application Load

1. `AuthGate` wraps all routes
2. Calls `GET /api/auth/info` to check if auth is required
3. If auth disabled, renders app immediately
4. If auth enabled, checks for JWT token in sessionStorage
5. If token exists, validates via `GET /api/auth/me`
6. If valid, renders app; if invalid, redirects to `/login`

### Login Flow

1. User enters credentials on `/login` page
2. `POST /api/auth/login` with username and password
3. Backend validates and returns JWT token
4. Token stored in sessionStorage
5. apiClient includes token in `Authorization` header
6. Redirect to homepage

### Logout Flow

1. User clicks logout button
2. Token removed from sessionStorage
3. `POST /api/auth/logout` (clears cookie)
4. Redirect to `/login`

### Token Expiration

1. apiClient intercepts 401 responses
2. Emits `auth:unauthorized` event
3. AuthContext listens and triggers logout
4. User redirected to `/login` with expired message

### SSE Authentication

**Problem**: EventSource cannot set headers, JWT in URL is insecure.

**Solution**: One-time tickets.

**Flow**:

```typescript
import { createAuthenticatedEventSource } from '@app/utils/sseTickets';

// Request ticket and create EventSource
const eventSource = await createAuthenticatedEventSource(jobId, 'transfer');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateProgress(data);
};

eventSource.onerror = () => {
  notifyError('Connection lost', 'Please refresh the page');
  eventSource.close();
};
```

## Utility Modules

### useModal Hook

**Purpose**: Reusable modal state management.

```typescript
const modal = useModal();

// API
modal.isOpen; // boolean
modal.open(); // () => void
modal.close(); // () => void
modal.toggle(); // () => void
```

### useStorageLocations Hook

**Purpose**: Load and manage storage locations.

```typescript
const { locations, loading, error, refreshLocations } = useStorageLocations();

// Features:
// - Automatic loading on mount
// - Integrated notification system
// - Error handling with user-friendly messages
```

### Notification Utilities

**Functions**:

```typescript
// Basic notifications
notifySuccess(title, description);
notifyError(title, description);
notifyWarning(title, description);
notifyInfo(title, description);

// API error handling
notifyApiError(operation, error);
```

**Implementation**:

```typescript
export function notifySuccess(title: string, description: string) {
  Emitter.emit('notification', {
    variant: 'success',
    title,
    description,
  });
}

export function notifyApiError(operation: string, error: any) {
  const message = error.response?.data?.message || error.message || 'An error occurred';

  console.error(`${operation} error:`, error);

  Emitter.emit('notification', {
    variant: 'danger',
    title: `Failed to ${operation}`,
    description: message,
  });
}
```

### Validation Utilities

**Bucket Name Validation**:

```typescript
validateS3BucketName(name: string, existingBuckets?: string[]): boolean
getBucketNameRules(): string[]
```

**Object Name Validation**:

```typescript
validateS3ObjectName(name: string, storageType?: 'local' | 's3'): boolean
getObjectNameRules(): string[]
getFolderNameRules(storageType: 'local' | 's3'): string[]
```

**AWS-Compliant Rules**:

- 3-63 characters for buckets
- Only lowercase letters, numbers, dots, hyphens
- Must start and end with letter or number
- No consecutive periods
- Not formatted as IP address

## Styling Architecture

### CSS Layers

1. **PatternFly 6 Design Tokens** (Foundation)

   - Semantic tokens with `--pf-t--` prefix
   - Auto-adapt to light/dark themes

2. **CSS Variables** (Application-level)

   - Custom variables in `app.css`
   - Modal widths, form dimensions, viewer heights
   - Use `--s4-*` prefix

3. **Utility Classes** (Component-level)
   - Reusable spacing, layout, text utilities
   - Reduce inline styles

### CSS Variables

```css
:root {
  /* Modal widths */
  --s4-modal-width-small: 400px;
  --s4-modal-width-standard: 500px;
  --s4-modal-width-medium: 50%;
  --s4-modal-width-large: 75%;

  /* Form dimensions */
  --s4-form-width-standard: 400px;

  /* Icon sizes */
  --s4-icon-size-sm: 16px;
  --s4-icon-size-md: 24px;

  /* Viewer heights */
  --s4-viewer-height: 70vh;
}
```

### Utility Classes

```css
/* Spacing */
.pf-u-margin-bottom-md {
  margin-bottom: var(--pf-t--global--spacer--md);
}
.pf-u-padding-md {
  padding: var(--pf-t--global--spacer--md);
}

/* Layout */
.pf-u-flex-column {
  display: flex;
  flex-direction: column;
}
.pf-u-full-height {
  height: 100%;
}

/* Text */
.pf-u-text-subtle {
  color: var(--pf-t--global--text--color--subtle);
}
.pf-u-text-center {
  text-align: center;
}
```

## Testing

### Testing Stack

- **Framework**: Jest
- **Testing Library**: React Testing Library
- **User Events**: @testing-library/user-event
- **Coverage**: Minimal (needs improvement)

### Testing Patterns

**Component Testing**:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('should open modal on button click', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);

  const button = screen.getByRole('button', { name: 'Open Modal' });
  await user.click(button);

  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
```

**PatternFly 6 Component Queries**:

- Modals: `role="dialog"`
- Dropdowns: `role="menuitem"`
- Buttons: `getByRole('button', { name: 'Button Text' })`
- Forms: `role="textbox"`, `role="combobox"`

## Performance Considerations

### Bundle Size

- Production build: ~2MB (includes PatternFly 6)
- Code splitting: Route-based (future enhancement)
- Tree shaking: Enabled via Webpack

### Rendering Optimization

- Lazy loading: Not implemented (future enhancement)
- Memoization: Use `React.memo()` for expensive components
- Virtualization: Not implemented (could improve large file lists)

## Known Limitations

1. **Simple Authentication** - Single admin user, no multi-user or RBAC
2. **No Service Layer** - API calls embedded in components
3. **i18n Quality** - Translations for non-English languages may need refinement
4. **Ephemeral Settings** - Not persisted unless from env vars
5. **No Global Error Boundary** - Component-level only
6. **Minimal Test Coverage** - Needs improvement
7. **SessionStorage for Tokens** - Cleared on tab close (intentional)

## Future Enhancements

1. **React Query** - Better API state management and caching
2. **Service Layer** - Centralize API calls outside components
3. **Global Error Boundary** - Catch and display unhandled errors
4. **Code Splitting** - Route-based lazy loading
5. **Virtual Scrolling** - For large file lists
6. **Offline Support** - Service worker for PWA capabilities

## Further Reading

- **[PatternFly 6 Guide](../development/pf6-guide/README.md)** - Complete PF6 development guide
- **[Backend Architecture](backend.md)** - API server implementation
- **[Development Guide](../development/frontend.md)** - Frontend development workflow
- **[API Reference](../api/README.md)** - Complete API documentation
