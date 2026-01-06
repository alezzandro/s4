# Testing Guide

Comprehensive testing strategies and patterns for S4.

## Overview

S4 uses Jest as the primary testing framework for both backend and frontend.

**Testing Stack**:

- **Jest** - Test runner and assertion library
- **aws-sdk-client-mock** - Mock AWS SDK operations (backend)
- **@testing-library/react** - React component testing (frontend)
- **@testing-library/user-event** - User interaction simulation (frontend)

## Running Tests

### All Tests

```bash
# Run all tests (backend + frontend)
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

### Backend Tests

```bash
# From project root
npm run test:backend

# From backend directory
cd backend
npm test

# With coverage
npm run test:coverage

# Watch mode
npm test -- --watch

# Specific file
npm test -- buckets.test.ts
```

### Frontend Tests

```bash
# From project root
npm run test:frontend

# From frontend directory
cd frontend
npm test

# With coverage
npm run test:coverage

# Watch mode
npm test -- --watch

# Specific file
npm test -- StorageBrowser.test.tsx
```

## Backend Testing

### Test Structure

```typescript
import { build } from '../app';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

describe('Buckets API', () => {
  let app: any;
  const s3Mock = mockClient(S3Client);

  beforeAll(async () => {
    app = await build();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    s3Mock.reset();
  });

  test('GET /api/buckets should return buckets', async () => {
    s3Mock.on(ListBucketsCommand).resolves({
      Buckets: [
        { Name: 'bucket1', CreationDate: new Date() },
        { Name: 'bucket2', CreationDate: new Date() },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/buckets',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('buckets');
    expect(response.json().buckets).toHaveLength(2);
  });
});
```

### Route Testing Patterns

#### GET Requests

```typescript
test('GET /api/buckets/:bucketName should return bucket objects', async () => {
  s3Mock.on(ListObjectsV2Command).resolves({
    Contents: [
      { Key: 'file1.txt', Size: 100, LastModified: new Date() },
      { Key: 'file2.txt', Size: 200, LastModified: new Date() },
    ],
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/buckets/test-bucket',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().objects).toHaveLength(2);
});
```

#### POST Requests

```typescript
test('POST /api/buckets should create bucket', async () => {
  s3Mock.on(CreateBucketCommand).resolves({});

  const response = await app.inject({
    method: 'POST',
    url: '/api/buckets',
    payload: { bucketName: 'test-bucket' },
  });

  expect(response.statusCode).toBe(201);
  expect(response.json()).toHaveProperty('message', 'Bucket created successfully');
});
```

#### DELETE Requests

```typescript
test('DELETE /api/buckets/:bucketName should delete bucket', async () => {
  s3Mock.on(DeleteBucketCommand).resolves({});

  const response = await app.inject({
    method: 'DELETE',
    url: '/api/buckets/test-bucket',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toHaveProperty('message', 'Bucket deleted successfully');
});
```

### Error Handling Tests

```typescript
test('should return 404 for non-existent bucket', async () => {
  s3Mock.on(HeadBucketCommand).rejects({
    name: 'NotFound',
    $metadata: { httpStatusCode: 404 },
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/buckets/non-existent',
  });

  expect(response.statusCode).toBe(404);
});

test('should return 409 for bucket already exists', async () => {
  s3Mock.on(CreateBucketCommand).rejects({
    name: 'BucketAlreadyExists',
    $metadata: { httpStatusCode: 409 },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/buckets',
    payload: { bucketName: 'existing-bucket' },
  });

  expect(response.statusCode).toBe(409);
});
```

### Mocking S3 Operations

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

const s3Mock = mockClient(S3Client);

// Mock successful operation
s3Mock.on(ListBucketsCommand).resolves({
  Buckets: [{ Name: 'test-bucket' }],
});

// Mock error
s3Mock.on(CreateBucketCommand).rejects({
  name: 'BucketAlreadyExists',
  $metadata: { httpStatusCode: 409 },
});

// Mock specific parameters
s3Mock.on(GetObjectCommand, { Bucket: 'test-bucket', Key: 'file.txt' }).resolves({
  Body: Buffer.from('file content'),
});

// Reset mock between tests
beforeEach(() => {
  s3Mock.reset();
});
```

### Authentication Tests

```typescript
describe('Protected routes', () => {
  test('should require authentication when enabled', async () => {
    // Set auth environment variables
    process.env.UI_USERNAME = 'admin';
    process.env.UI_PASSWORD = 'pass';

    const response = await app.inject({
      method: 'GET',
      url: '/api/buckets',
    });

    expect(response.statusCode).toBe(401);
  });

  test('should accept valid JWT token', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'pass' },
    });

    const { token } = loginResponse.json();

    const response = await app.inject({
      method: 'GET',
      url: '/api/buckets',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
  });
});
```

### Validation Tests

```typescript
test('should validate bucket name', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/buckets',
    payload: { bucketName: 'INVALID-NAME' }, // Uppercase not allowed
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toHaveProperty('error');
});

test('should reject missing required fields', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/buckets',
    payload: {}, // Missing bucketName
  });

  expect(response.statusCode).toBe(400);
});
```

## Frontend Testing

### Test Structure

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import MyComponent from './MyComponent';

// Mock API client
jest.mock('@app/utils/apiClient');

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <MyComponent />
    </BrowserRouter>
  );
};

describe('MyComponent', () => {
  test('should render component', () => {
    renderComponent();
    expect(screen.getByText('My Component')).toBeInTheDocument();
  });
});
```

### Component Testing Patterns

#### Rendering

```typescript
test('should render bucket list', async () => {
  const mockBuckets = [
    { name: 'bucket1', creationDate: '2024-01-01' },
    { name: 'bucket2', creationDate: '2024-01-02' },
  ];

  apiClient.get.mockResolvedValue({ data: { buckets: mockBuckets } });

  render(<Buckets />);

  await waitFor(() => {
    expect(screen.getByText('bucket1')).toBeInTheDocument();
    expect(screen.getByText('bucket2')).toBeInTheDocument();
  });
});
```

#### User Interactions

```typescript
test('should open create modal on button click', async () => {
  const user = userEvent.setup();
  render(<Buckets />);

  const createButton = screen.getByRole('button', { name: 'Create Bucket' });
  await user.click(createButton);

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Create New Bucket')).toBeInTheDocument();
});

test('should submit form on enter', async () => {
  const user = userEvent.setup();
  render(<CreateBucketModal />);

  const input = screen.getByRole('textbox', { name: 'Bucket name' });
  await user.type(input, 'my-bucket{Enter}');

  await waitFor(() => {
    expect(apiClient.post).toHaveBeenCalledWith('/api/buckets', {
      bucketName: 'my-bucket',
    });
  });
});
```

#### API Mocking

```typescript
import apiClient from '@app/utils/apiClient';

jest.mock('@app/utils/apiClient');

test('should handle API success', async () => {
  apiClient.post.mockResolvedValue({ data: { success: true } });

  const user = userEvent.setup();
  render(<CreateBucketModal />);

  const input = screen.getByRole('textbox');
  await user.type(input, 'my-bucket');

  const submitButton = screen.getByRole('button', { name: 'Create' });
  await user.click(submitButton);

  await waitFor(() => {
    expect(screen.getByText('Bucket created successfully')).toBeInTheDocument();
  });
});

test('should handle API error', async () => {
  apiClient.post.mockRejectedValue({
    response: { data: { error: 'Bucket already exists' } },
  });

  const user = userEvent.setup();
  render(<CreateBucketModal />);

  const input = screen.getByRole('textbox');
  await user.type(input, 'existing-bucket');

  const submitButton = screen.getByRole('button', { name: 'Create' });
  await user.click(submitButton);

  await waitFor(() => {
    expect(screen.getByText(/Bucket already exists/i)).toBeInTheDocument();
  });
});
```

#### Loading States

```typescript
test('should show loading state while fetching', () => {
  apiClient.get.mockImplementation(() => new Promise(() => {}));  // Never resolves

  render(<Buckets />);

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

test('should hide loading state after data loaded', async () => {
  apiClient.get.mockResolvedValue({ data: { buckets: [] } });

  render(<Buckets />);

  await waitFor(() => {
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
```

### PatternFly 6 Testing Patterns

#### Modals

```typescript
test('should close modal on cancel', async () => {
  const user = userEvent.setup();
  render(<MyModalComponent />);

  // Open modal
  const openButton = screen.getByRole('button', { name: 'Open' });
  await user.click(openButton);

  expect(screen.getByRole('dialog')).toBeInTheDocument();

  // Close modal
  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  await user.click(cancelButton);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
```

#### Dropdowns

```typescript
test('should select dropdown option', async () => {
  const user = userEvent.setup();
  render(<MyDropdownComponent />);

  const dropdown = screen.getByRole('button', { name: 'Select option' });
  await user.click(dropdown);

  const option = screen.getByRole('menuitem', { name: 'Option 1' });
  await user.click(option);

  expect(screen.getByText('Option 1 selected')).toBeInTheDocument();
});
```

#### Tables

```typescript
test('should render table rows', () => {
  const data = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
  ];

  render(<MyTableComponent data={data} />);

  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(3);  // Header + 2 data rows
});
```

#### Forms

```typescript
test('should validate form input', async () => {
  const user = userEvent.setup();
  render(<MyFormComponent />);

  const input = screen.getByRole('textbox', { name: 'Bucket name' });
  await user.type(input, 'INVALID');

  const submitButton = screen.getByRole('button', { name: 'Submit' });
  await user.click(submitButton);

  expect(screen.getByText(/must be lowercase/i)).toBeInTheDocument();
});
```

### Custom Hook Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useStorageLocations } from '@app/hooks';

jest.mock('@app/utils/apiClient');

test('should load storage locations', async () => {
  const mockLocations = [{ id: 's3-bucket1', name: 'Bucket 1', type: 's3', available: true }];

  apiClient.get.mockResolvedValue({ data: { locations: mockLocations } });

  const { result } = renderHook(() => useStorageLocations());

  expect(result.current.loading).toBe(true);

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
    expect(result.current.locations).toEqual(mockLocations);
  });
});
```

## Coverage Requirements

### Running Coverage

```bash
# Backend coverage
npm run test:coverage -- backend

# Frontend coverage
npm run test:coverage -- frontend

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Targets

While S4 currently has minimal test coverage, aim for these targets in new code:

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

### Critical Areas to Test

**Backend**:

- All API endpoints (success and error cases)
- Input validation
- Authentication and authorization
- S3 error handling
- File streaming operations

**Frontend**:

- Component rendering
- User interactions
- API error handling
- Form validation
- Modal workflows

## Test Utilities

### Backend Utilities

Create test helpers in `backend/src/__tests__/utils/`:

```typescript
// testHelpers.ts
export const createMockS3Client = () => {
  return mockClient(S3Client);
};

export const createAuthToken = async (app: any) => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'admin', password: 'pass' },
  });
  return response.json().token;
};

export const injectWithAuth = async (app: any, options: any) => {
  const token = await createAuthToken(app);
  return app.inject({
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
};
```

### Frontend Utilities

Create test helpers in `frontend/src/app/__tests__/utils/`:

```typescript
// testHelpers.tsx
export const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

export const renderWithAuth = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={{ user: { id: '1', username: 'admin' }, isAuthenticated: true }}>
        {component}
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

export const mockApiSuccess = (endpoint: string, data: any) => {
  apiClient.get.mockResolvedValue({ data });
  apiClient.post.mockResolvedValue({ data });
};

export const mockApiError = (endpoint: string, error: any) => {
  apiClient.get.mockRejectedValue(error);
  apiClient.post.mockRejectedValue(error);
};
```

## Best Practices

### DO

- ✅ Test both success and error cases
- ✅ Mock external dependencies (S3, API calls)
- ✅ Use `waitFor` for async operations
- ✅ Test user interactions with `userEvent`
- ✅ Query by role for accessibility
- ✅ Write descriptive test names
- ✅ Keep tests focused and simple
- ✅ Clean up after tests (reset mocks)
- ✅ Test edge cases and error handling

### DON'T

- ❌ Test implementation details
- ❌ Make tests dependent on each other
- ❌ Use `act()` directly (use `waitFor` instead)
- ❌ Query by class names or internal structure
- ❌ Mock everything (test real logic when possible)
- ❌ Skip error case testing
- ❌ Write brittle tests that break on UI changes
- ❌ Ignore flaky tests

## Debugging Tests

### Backend

```bash
# Run tests with verbose output
npm test -- --verbose

# Debug specific test
node --inspect-brk node_modules/.bin/jest buckets.test.ts

# Add console.log in test
test('should do something', () => {
  console.log('Debug:', response.json());
  expect(...);
});
```

### Frontend

```bash
# Run tests with verbose output
npm test -- --verbose

# Debug specific test
node --inspect-brk node_modules/.bin/jest StorageBrowser.test.tsx

# Use screen.debug() in test
test('should render', () => {
  render(<MyComponent />);
  screen.debug();  // Prints DOM tree
});
```

## Continuous Integration

Tests run automatically in CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test

- name: Upload coverage
  run: npm run test:coverage
```

Ensure all tests pass before merging pull requests.

## Related Documentation

- [Backend Development](./backend.md) - Backend development patterns
- [Frontend Development](./frontend.md) - Frontend development patterns
- [Code Style Guide](./code-style.md) - Coding standards
- [Contributing Guide](./contributing.md) - Contribution workflow
