# Frontend Development Guide

Guide for developing the S4 React frontend.

## Overview

The S4 frontend is a React 18 application with TypeScript, PatternFly 6, and React Router 7.

**Technology Stack**:

- React 18.x
- PatternFly 6.x
- React Router 7.x
- TypeScript 5.x
- Webpack 5.x

## Development Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server with HMR
npm run start:dev

# Access at http://localhost:9000
```

The frontend dev server runs on port **9000** with Hot Module Replacement (HMR).

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── components/        # React components
│   │   │   ├── AppLayout.tsx    # Main layout with navigation
│   │   │   ├── AuthContext.tsx  # Authentication state
│   │   │   ├── AuthGate.tsx     # Route protection
│   │   │   ├── Login.tsx        # Login form
│   │   │   ├── StorageBrowser.tsx  # Storage browser
│   │   │   ├── Buckets.tsx         # Bucket management
│   │   │   ├── Settings.tsx        # S3 configuration
│   │   │   └── ...
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useModal.ts      # Modal state management
│   │   │   └── useStorageLocations.ts  # Storage loading
│   │   ├── utils/             # Utilities
│   │   │   ├── apiClient.ts     # Axios instance
│   │   │   ├── notifications.ts # Toast notifications
│   │   │   ├── validation.ts    # Input validation
│   │   │   ├── sseTickets.ts    # SSE authentication
│   │   │   └── EventEmitter.ts  # Event bus
│   │   ├── services/          # API services
│   │   │   └── storageService.ts  # Storage API
│   │   ├── routes.tsx         # Route definitions
│   │   ├── app.css            # Global styles
│   │   └── index.tsx          # App component
│   ├── i18n/                  # Internationalization
│   └── index.tsx              # Entry point
├── dist/                      # Webpack output
└── webpack.*.js               # Webpack configs
```

## PatternFly 6 Requirements

**CRITICAL**: S4 uses PatternFly 6, which has breaking changes from v5.

### Class Prefix

ALL PatternFly classes MUST use `pf-v6-` prefix:

```css
/* ✅ CORRECT */
.pf-v6-c-button {
}
.pf-v6-c-modal {
}

/* ❌ WRONG */
.pf-c-button {
}
.pf-v5-c-button {
}
```

### Component Imports

Import from `@patternfly/react-core` v6:

```typescript
import { Button, Card, Modal, Page, PageSection, Toolbar, ToolbarContent, ToolbarItem } from '@patternfly/react-core';

import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { TrashIcon, UploadIcon } from '@patternfly/react-icons';
```

### Design Tokens

Use semantic tokens with `--pf-t--` prefix:

```css
/* ✅ CORRECT - Semantic tokens */
.my-element {
  color: var(--pf-t--global--color--brand--default);
  padding: var(--pf-t--global--spacer--md);
  background: var(--pf-t--global--background--color--primary--default);
}

/* ❌ WRONG - Legacy tokens or hardcoded values */
.my-element {
  color: var(--pf-v6-global--Color--100);
  padding: 16px;
  background: #ffffff;
}
```

Choose tokens by **meaning**, not appearance:

- `--pf-t--global--color--brand--default` - Brand color (adapts to theme)
- `--pf-t--global--color--status--danger--default` - Danger state
- `--pf-t--global--spacer--md` - Medium spacing
- `--pf-t--global--background--color--primary--default` - Primary background

## Component Development

### Component Checklist

Before creating ANY component:

1. **Search for similar components** - Avoid duplication
2. **Follow PatternFly 6 requirements** - Use `pf-v6-` prefix, semantic tokens
3. **Use established patterns** - Check existing components

### Essential Component Rules

#### 1. Error Handling

Use notification utilities for user-facing errors:

```typescript
import { notifySuccess, notifyError, notifyApiError } from '@app/utils/notifications';

try {
  await apiClient.post('/api/buckets', { bucketName });
  notifySuccess('Bucket created', `Bucket ${bucketName} created successfully`);
} catch (error) {
  notifyApiError('Create bucket', error);
}
```

#### 2. Data Fetching

Use direct axios calls with local state:

```typescript
import apiClient from '@app/utils/apiClient';

const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    const response = await apiClient.get('/api/buckets');
    setData(response.data.buckets);
  } catch (error) {
    notifyApiError('Load buckets', error);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchData();
}, []);
```

#### 3. Internationalization

Use `t()` function - never hardcode user-facing text:

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Button>{t('common:create')}</Button>
  );
};
```

#### 4. Accessibility

Include ARIA labels and keyboard navigation:

```typescript
<Button
  aria-label="Delete bucket"
  onClick={handleDelete}
>
  <TrashIcon />
</Button>

<Modal
  title={t('buckets:deleteModal.title')}
  isOpen={modal.isOpen}
  onClose={modal.close}
  aria-describedby="delete-modal-description"
>
  <p id="delete-modal-description">
    {t('buckets:deleteModal.description')}
  </p>
</Modal>
```

## Reusable Hooks

### useModal Hook

Manages modal open/close state:

```typescript
import { useModal } from '@app/hooks';

const MyComponent: React.FC = () => {
  const createModal = useModal();
  const deleteModal = useModal();

  return (
    <>
      <Button onClick={createModal.open}>Create</Button>
      <Modal isOpen={createModal.isOpen} onClose={createModal.close}>
        {/* Modal content */}
      </Modal>

      <Button onClick={deleteModal.open}>Delete</Button>
      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.close}>
        {/* Modal content */}
      </Modal>
    </>
  );
};
```

**API**:

- `isOpen: boolean` - Current modal state
- `open: () => void` - Open the modal
- `close: () => void` - Close the modal
- `toggle: () => void` - Toggle modal state

### useStorageLocations Hook

Loads and manages storage locations with automatic error handling:

```typescript
import { useStorageLocations } from '@app/hooks';

const MyComponent: React.FC = () => {
  const { locations, loading, error, refreshLocations } = useStorageLocations();

  if (loading) return <Spinner />;
  if (error) return <Alert variant="danger" title={error} />;

  return (
    <>
      {locations.map(location => (
        <div key={location.id}>
          {location.name} - {location.available ? 'Available' : 'Unavailable'}
        </div>
      ))}
      <Button onClick={refreshLocations}>Refresh</Button>
    </>
  );
};
```

**API**:

- `locations: StorageLocation[]` - Array of storage locations
- `loading: boolean` - Loading state
- `error: string | null` - Error message if loading failed
- `refreshLocations: () => Promise<void>` - Refresh locations

## Notification Utilities

Centralized notification utilities for consistent user feedback:

```typescript
import { notifySuccess, notifyError, notifyWarning, notifyInfo, notifyApiError } from '@app/utils/notifications';

// Success notification
notifySuccess('Operation successful', 'Your file has been uploaded');

// Error notification
notifyError('Operation failed', 'Unable to delete bucket');

// Warning notification
notifyWarning('Low disk space', 'Consider cleaning up old files');

// Info notification
notifyInfo('Maintenance scheduled', 'System will be down at midnight');

// API error handling
try {
  await apiClient.post('/api/buckets', { bucketName });
} catch (error) {
  notifyApiError('Create bucket', error); // Extracts error from Axios response
}
```

## Validation Utilities

Comprehensive validation utilities for S3 names:

### Bucket Name Validation

```typescript
import { validateS3BucketName, getBucketNameRules } from '@app/utils/validation';

// Validate bucket name
const isValid = validateS3BucketName('my-bucket');

// Validate with duplicate checking
const existingBuckets = ['bucket1', 'bucket2'];
const isValid = validateS3BucketName('new-bucket', existingBuckets);

// Get validation rules to display
const rules = getBucketNameRules();
// Returns array: ["Bucket names must be between 3 and 63 characters long", ...]
```

**Validation Rules** (AWS-compliant):

- 3-63 characters long
- Only lowercase letters, numbers, dots (.), and hyphens (-)
- Must start and end with letter or number
- No consecutive periods
- Not formatted as IP address
- No duplicates

### Object/Folder Name Validation

```typescript
import { validateS3ObjectName, getObjectNameRules, getFolderNameRules } from '@app/utils/validation';

// Validate S3 object name
const isValid = validateS3ObjectName('models/llama/config.json');

// Validate folder name (storage-type-specific)
const isValidLocal = validateS3ObjectName('my-folder', 'local');
const isValidS3 = validateS3ObjectName('my-folder', 's3');

// Get validation rules
const objectRules = getObjectNameRules();
const folderRules = getFolderNameRules('s3');
```

### Usage in Forms

```typescript
const CreateBucketModal: React.FC = () => {
  const [bucketName, setBucketName] = useState('');
  const [showRules, setShowRules] = useState(false);

  const handleSubmit = () => {
    if (!validateS3BucketName(bucketName)) {
      notifyError('Invalid bucket name', 'Please check the bucket naming rules');
      return;
    }
    // Proceed with creation
  };

  return (
    <Form>
      <FormGroup label="Bucket name" isRequired>
        <TextInput
          value={bucketName}
          onChange={(_, value) => setBucketName(value)}
          onFocus={() => setShowRules(true)}
          validated={bucketName && !validateS3BucketName(bucketName) ? 'error' : 'default'}
        />
        {showRules && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                Bucket naming rules:
                <ul>
                  {getBucketNameRules().map(rule => <li key={rule}>{rule}</li>)}
                </ul>
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>
    </Form>
  );
};
```

## Styling Guidelines

### CSS Architecture

S4 uses layered CSS:

1. **PatternFly 6 Design Tokens** - Foundation (semantic tokens)
2. **CSS Variables** - Application-level custom values
3. **Utility Classes** - Component-level reusable classes

### CSS Variables

Define custom variables in `app.css`:

```css
:root {
  /* Modal widths */
  --s4-modal-width-small: 400px;
  --s4-modal-width-standard: 500px;
  --s4-modal-width-medium: 50%;
  --s4-modal-width-large: 75%;

  /* Form dimensions */
  --s4-form-width-standard: 400px;
  --s4-input-width-medium: 300px;

  /* Icon sizes */
  --s4-icon-size-sm: 16px;
  --s4-icon-size-md: 24px;
}
```

### Utility Classes

Reusable classes in `app.css`:

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

/* Icons */
.pf-u-icon-sm {
  height: var(--s4-icon-size-sm);
}
.pf-u-icon-md {
  height: var(--s4-icon-size-md);
}
```

### Example Component Styling

```typescript
const MyComponent: React.FC = () => (
  <Card className="pf-u-margin-bottom-md">
    <CardTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pf-t--global--spacer--sm)' }}>
        <UploadIcon className="pf-u-icon-sm" />
        <span>Upload Files</span>
      </div>
    </CardTitle>
    <CardBody>
      <p className="pf-u-text-subtle">Select files to upload</p>
    </CardBody>
  </Card>
);
```

## Authentication Flow

### AuthGate Wrapper

All routes are protected by `AuthGate`:

```typescript
// In routes.tsx
<AuthGate>
  <Routes>
    <Route path="/" element={<Navigate to="/browse" />} />
    <Route path="/browse/*" element={<StorageBrowser />} />
    <Route path="/buckets" element={<Buckets />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/login" element={<Login />} />
  </Routes>
</AuthGate>
```

### Login Flow

1. User enters credentials on `/login`
2. `POST /api/auth/login` with username and password
3. Backend returns JWT token
4. Token stored in sessionStorage
5. `apiClient` includes token in `Authorization: Bearer <token>` header
6. Redirect to homepage

### Token Expiration

- `apiClient` intercepts 401 responses
- Emits `auth:unauthorized` event
- `AuthContext` triggers logout
- User redirected to `/login`

### SSE Authentication

S4 uses **one-time tickets** for SSE connections instead of JWT tokens:

```typescript
import { createAuthenticatedEventSource } from '@app/utils/sseTickets';

// For transfer progress
const eventSource = await createAuthenticatedEventSource(jobId, 'transfer');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle progress updates
};

// For upload progress
const eventSource = await createAuthenticatedEventSource(encodedKey, 'upload');
```

**Why tickets instead of JWT in URLs?**

- JWT tokens in query parameters get logged by proxies and browsers
- Tickets are single-use and expire quickly (60s vs 8 hours)
- Tickets are resource-scoped (tied to specific transfer/upload)
- EventSource API cannot set custom headers

## Routing

React Router v7 handles navigation:

```typescript
// routes.tsx
export const routes = [
  {
    path: '/',
    element: <Navigate to="/browse" />,
  },
  {
    path: '/browse',
    element: <StorageBrowser />,
    children: [
      { path: ':locationId', element: <StorageBrowser /> },
      { path: ':locationId/:path', element: <StorageBrowser /> },
    ],
  },
  {
    path: '/buckets',
    element: <Buckets />,
  },
  {
    path: '/settings',
    element: <Settings />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
];
```

### URL Encoding Strategy

**LocationId (NOT encoded)**:

- S3 bucket names: Validated to URL-safe `[a-z0-9-]`
- PVC locations: Pattern `local-0`, `local-1` (always URL-safe)
- Benefit: Human-readable URLs like `/browse/my-bucket`

**Path (Base64-encoded)**:

- Contains slashes, spaces, special characters
- Example: `models/llama/config.json` → `bW9kZWxzL2xsYW1hL2NvbmZpZy5qc29u`
- Benefit: Handles all characters without URL encoding issues

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch

# Specific file
npm test -- StorageBrowser.test.tsx
```

### Testing Patterns

#### Component Testing

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

#### PatternFly 6 Testing

```typescript
// Modals
expect(screen.getByRole('dialog')).toBeInTheDocument();

// Dropdowns
const option = screen.getByRole('menuitem', { name: 'Option 1' });
await user.click(option);

// Buttons
const button = screen.getByRole('button', { name: 'Submit' });
await user.click(button);

// Forms
const input = screen.getByRole('textbox', { name: 'Bucket name' });
await user.type(input, 'my-bucket');
```

## Building for Production

```bash
# Build for production
npm run build

# Output in dist/
```

Production build:

- Webpack production optimization
- Minification and tree-shaking
- Source maps for debugging
- Served by Fastify backend on port 5000

## Best Practices

### DO

- ✅ Use PatternFly 6 components with `pf-v6-` prefix
- ✅ Use semantic design tokens (`--pf-t--`)
- ✅ Use notification utilities for user feedback
- ✅ Use validation utilities for input validation
- ✅ Use `useModal()` hook for modal state
- ✅ Use `useStorageLocations()` hook for storage loading
- ✅ Use CSS utility classes to reduce inline styles
- ✅ Use `--s4-*` CSS variables for repeated values
- ✅ Handle errors with notification utilities
- ✅ Use `t()` function for all user-facing text
- ✅ Include ARIA labels and accessibility
- ✅ Run `npm run format` before committing

### DON'T

- ❌ Use PatternFly 5 or hardcoded `pf-` classes
- ❌ Hardcode colors, sizes, or spacing
- ❌ Use legacy `--pf-v6-global--` tokens
- ❌ Create manual modal state with useState
- ❌ Manually call `Emitter.emit('notification', ...)`
- ❌ Write duplicate validation logic
- ❌ Use inline styles for spacing/layout
- ❌ Hardcode repeated dimensions
- ❌ Skip accessibility features
- ❌ Use `alert()` for user-facing errors
- ❌ Put JWT tokens in SSE URLs

## Related Documentation

- [Frontend Architecture](../architecture/frontend.md) - Detailed architecture overview
- [Testing Guide](./testing.md) - Testing strategies and patterns
- [Code Style Guide](./code-style.md) - Coding standards
- [API Reference](../api/README.md) - Backend API documentation
