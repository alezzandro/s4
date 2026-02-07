# Code Style Guide

Coding standards and conventions for the S4 project.

## Overview

S4 uses consistent coding standards across backend and frontend to ensure maintainability and readability.

**Tools**:

- **TypeScript** - Type safety and modern JavaScript features
- **ESLint** - Code linting and best practices
- **Prettier** - Code formatting
- **EditorConfig** - Consistent editor settings

## General Principles

1. **Consistency** - Follow existing patterns in the codebase
2. **Clarity** - Write self-documenting code
3. **Simplicity** - Prefer simple solutions over clever ones
4. **Type Safety** - Use TypeScript properly, avoid `any`
5. **DRY** - Don't Repeat Yourself

## TypeScript

### Type Annotations

Use explicit type annotations for function parameters and return types:

```typescript
// ✅ GOOD
function calculateTotal(price: number, quantity: number): number {
  return price * quantity;
}

// ❌ BAD
function calculateTotal(price, quantity) {
  return price * quantity;
}
```

### Interfaces vs Types

Use `interface` for object shapes, `type` for unions and complex types:

```typescript
// ✅ GOOD - Interface for object shape
interface BucketParams {
  bucketName: string;
}

// ✅ GOOD - Type for union
type Status = 'success' | 'error' | 'pending';

// ✅ GOOD - Type for complex types
type TypedRequest<TParams = {}, TQuery = {}, TBody = {}> = FastifyRequest<{
  Params: TParams;
  Querystring: TQuery;
  Body: TBody;
}>;
```

### Avoid `any`

Minimize use of `any`. Use specific types or `unknown` instead:

```typescript
// ✅ GOOD
function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error(error.message);
  }
}

// ❌ BAD
function handleError(error: any): void {
  console.error(error.message);
}
```

Justified `any` usage must have a `// JUSTIFICATION:` comment.

### Null and Undefined

Use optional properties and nullish coalescing:

```typescript
// ✅ GOOD
interface User {
  id: string;
  name: string;
  email?: string; // Optional property
}

const displayName = user.name ?? 'Anonymous';

// ❌ BAD
interface User {
  id: string;
  name: string;
  email: string | null | undefined;
}

const displayName = user.name ? user.name : 'Anonymous';
```

## Naming Conventions

### Files and Directories

- **Components** - PascalCase: `StorageBrowser.tsx`, `CreateBucketModal.tsx`
- **Utilities** - camelCase: `apiClient.ts`, `validation.ts`
- **Tests** - Match source file: `StorageBrowser.test.tsx`, `validation.test.ts`
- **Constants** - camelCase: `constants.ts`, `httpStatus.ts`

### Variables and Functions

- **Variables** - camelCase: `bucketName`, `isLoading`, `userCount`
- **Constants** - UPPER_SNAKE_CASE: `MAX_FILE_SIZE`, `DEFAULT_REGION`
- **Functions** - camelCase: `fetchBuckets`, `handleDelete`, `validateInput`
- **React Components** - PascalCase: `StorageBrowser`, `BucketList`

### Types and Interfaces

- **Interfaces** - PascalCase: `BucketParams`, `S3Config`, `StorageLocation`
- **Types** - PascalCase: `TypedRequest`, `HttpStatus`, `AuthMode`
- **Enums** - PascalCase: `TransferStatus`, `StorageType`

### Boolean Names

Use descriptive boolean names with prefixes:

```typescript
// ✅ GOOD
const isLoading = true;
const hasError = false;
const canDelete = true;
const shouldRefresh = false;

// ❌ BAD
const loading = true;
const error = false;
const delete = true;
```

## Code Formatting

### Prettier Configuration

S4 uses Prettier for consistent formatting. Run before committing:

```bash
npm run format
```

**Key Rules** (`.prettierrc`):

- **Print Width**: 100 characters
- **Tab Width**: 2 spaces
- **Semicolons**: Always
- **Quotes**: Single quotes
- **Trailing Commas**: ES5 style
- **Arrow Parens**: Avoid when possible

### Manual Formatting

When Prettier doesn't apply:

```typescript
// ✅ GOOD - Readable object formatting
const config = {
  endpoint: 'http://localhost:7480',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'admin',
    secretAccessKey: 'secret',
  },
};

// ✅ GOOD - Readable array formatting
const buckets = [
  { name: 'bucket1', size: 100 },
  { name: 'bucket2', size: 200 },
  { name: 'bucket3', size: 300 },
];

// ❌ BAD - Unreadable
const config = {
  endpoint: 'http://localhost:7480',
  region: 'us-east-1',
  credentials: { accessKeyId: 'admin', secretAccessKey: 'secret' },
};
```

## Backend Standards

### Fastify Plugin Pattern

All routes must be Fastify plugins:

```typescript
// ✅ GOOD
import { FastifyInstance } from 'fastify';

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.get('/endpoint', async (req, reply) => {
    return { data: [] };
  });
};

// ❌ BAD - Not a plugin
fastify.get('/endpoint', async (req, reply) => {
  return { data: [] };
});
```

### Error Handling

Use centralized error handlers:

```typescript
// ✅ GOOD
import { handleS3Error } from '../../../utils/errorHandler';

try {
  const result = await s3Client.send(command);
} catch (error) {
  await handleS3Error(error, reply, req.log);
}

// ❌ BAD - Manual error handling
try {
  const result = await s3Client.send(command);
} catch (error) {
  reply.code(500).send({ error: error.message });
}
```

### HTTP Status Codes

Use named constants:

```typescript
// ✅ GOOD
import { HttpStatus } from '../../../utils/httpStatus';

reply.code(HttpStatus.OK).send({ message: 'Success' });
reply.code(HttpStatus.NOT_FOUND).send({ error: 'Not found' });

// ❌ BAD - Magic numbers
reply.code(200).send({ message: 'Success' });
reply.code(404).send({ error: 'Not found' });
```

### Type Safety

Use `TypedRequest` instead of type casting:

```typescript
// ✅ GOOD
import { TypedRequest, BucketParams } from '../../../types';

fastify.get('/:bucketName', async (req: TypedRequest<BucketParams>, reply) => {
  const { bucketName } = req.params; // Fully typed
});

// ❌ BAD - Type casting
fastify.get('/:bucketName', async (req, reply) => {
  const { bucketName } = req.params as any;
});
```

### Logging

Use request logger in routes:

```typescript
// ✅ GOOD - Use req.log
fastify.get('/endpoint', async (req, reply) => {
  req.log.info('Processing request');
  req.log.error(sanitizeErrorForLogging(error));
});

// ✅ GOOD - Use createLogger in utilities
import { createLogger } from '../utils/logger';
const logger = createLogger(undefined, '[MyUtility]');
logger.info('Operation started');

// ❌ BAD - Direct console.log
fastify.get('/endpoint', async (req, reply) => {
  console.log('Processing request');
});
```

## Frontend Standards

### PatternFly 6 Requirements

Use `pf-v6-` prefix for all PatternFly classes:

```css
/* ✅ GOOD */
.pf-v6-c-button {
}
.pf-v6-c-modal {
}

/* ❌ BAD */
.pf-c-button {
}
.pf-v5-c-button {
}
```

### Design Tokens

Use semantic tokens with `--pf-t--` prefix:

```css
/* ✅ GOOD - Semantic tokens */
.my-element {
  color: var(--pf-t--global--color--brand--default);
  padding: var(--pf-t--global--spacer--md);
}

/* ❌ BAD - Hardcoded or legacy tokens */
.my-element {
  color: #0066cc;
  padding: 16px;
}
```

### Component Structure

Organize components consistently:

```typescript
// ✅ GOOD - Organized structure
import React, { useState, useEffect } from 'react';
import { Button, Modal } from '@patternfly/react-core';
import { TrashIcon } from '@patternfly/react-icons';
import { useModal } from '@app/hooks';
import { notifySuccess, notifyError } from '@app/utils/notifications';
import apiClient from '@app/utils/apiClient';

interface MyComponentProps {
  bucketName: string;
  onDelete: () => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ bucketName, onDelete }) => {
  const [loading, setLoading] = useState(false);
  const deleteModal = useModal();

  const handleDelete = async () => {
    setLoading(true);
    try {
      await apiClient.delete(`/api/buckets/${bucketName}`);
      notifySuccess('Deleted', `Bucket ${bucketName} deleted`);
      deleteModal.close();
      onDelete();
    } catch (error) {
      notifyError('Delete failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={deleteModal.open}>Delete</Button>
      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.close}>
        {/* Modal content */}
      </Modal>
    </>
  );
};

export default MyComponent;
```

### Hooks Usage

Use custom hooks for common patterns:

```typescript
// ✅ GOOD - Use custom hook
const deleteModal = useModal();

// ❌ BAD - Manual state management
const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
```

### Notification Handling

Use notification utilities:

```typescript
// ✅ GOOD - Use utility functions
import { notifySuccess, notifyApiError } from '@app/utils/notifications';

try {
  await apiClient.post('/api/buckets', { bucketName });
  notifySuccess('Bucket created', `Bucket ${bucketName} created successfully`);
} catch (error) {
  notifyApiError('Create bucket', error);
}

// ❌ BAD - Manual event emission
import Emitter from '@app/utils/EventEmitter';

Emitter.emit('notification', {
  variant: 'success',
  title: 'Bucket created',
  description: `Bucket ${bucketName} created successfully`,
});
```

### Validation

Use validation utilities:

```typescript
// ✅ GOOD - Use validation utility
import { validateS3BucketName } from '@app/utils/validation';

const isValid = validateS3BucketName(bucketName);

// ❌ BAD - Manual validation
const isValid = /^[a-z0-9-]{3,63}$/.test(bucketName);
```

## ESLint Rules

S4 uses ESLint to enforce code quality. Run before committing:

```bash
npm run lint
```

### Key Rules

- **no-console** - Warn (use logger instead)
- **no-unused-vars** - Error
- **no-explicit-any** - Warn (avoid `any` when possible)
- **prefer-const** - Error
- **no-var** - Error (use `let` or `const`)
- **eqeqeq** - Error (use `===` instead of `==`)

### Disabling Rules

Only disable rules when necessary with explanation:

```typescript
// ✅ GOOD - Justified with explanation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const response = req.raw as any; // JUSTIFICATION: Fastify raw request type mismatch

// ❌ BAD - Blanket disable
/* eslint-disable */
```

## Comments

### When to Comment

- **Why, not What** - Explain reasoning, not obvious code
- **Complex Logic** - Document non-obvious algorithms
- **Justifications** - Explain necessary workarounds
- **TODOs** - Mark temporary solutions

### Comment Style

```typescript
// ✅ GOOD - Explains why
// Use one-time tickets instead of JWT in URLs to prevent token leakage
const ticket = await generateSseTicket(jobId);

// ✅ GOOD - Documents complex logic
/**
 * Validates S3 bucket name according to AWS naming rules:
 * - 3-63 characters
 * - Lowercase letters, numbers, dots, hyphens
 * - Must start/end with letter or number
 * - No consecutive periods or IP addresses
 */
export function validateS3BucketName(name: string): boolean {
  // Implementation
}

// ❌ BAD - States the obvious
// Increment counter by 1
counter++;
```

### JSDoc for Public APIs

Document public functions with JSDoc:

```typescript
/**
 * Creates an authenticated EventSource connection for SSE endpoints.
 *
 * @param resource - The resource identifier (jobId or encodedKey)
 * @param resourceType - The type of resource ('transfer' or 'upload')
 * @returns Promise that resolves to an EventSource instance
 * @throws Error if ticket generation fails
 */
export async function createAuthenticatedEventSource(
  resource: string,
  resourceType: 'transfer' | 'upload',
): Promise<EventSource> {
  // Implementation
}
```

## Testing Standards

### Test Structure

Use consistent test structure:

```typescript
describe('MyComponent', () => {
  // Setup
  beforeEach(() => {
    // Common setup
  });

  afterEach(() => {
    // Cleanup
  });

  // Tests grouped by functionality
  describe('rendering', () => {
    test('should render component', () => {
      // Test
    });
  });

  describe('user interactions', () => {
    test('should open modal on button click', async () => {
      // Test
    });
  });

  describe('error handling', () => {
    test('should handle API errors', async () => {
      // Test
    });
  });
});
```

### Test Naming

Use descriptive test names:

```typescript
// ✅ GOOD - Descriptive
test('should display error message when bucket creation fails', async () => {});
test('should close modal on cancel button click', async () => {});

// ❌ BAD - Vague
test('error handling', async () => {});
test('modal', async () => {});
```

## Git Commit Messages

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Examples

```
feat(backend): add bucket tagging support

Implements PUT and GET endpoints for bucket tags.
Includes validation and error handling.

Closes #123

fix(frontend): resolve modal close issue

The create bucket modal was not closing after successful creation.
Added proper cleanup in useEffect.

Fixes #456

docs(api): update authentication examples

Added examples for SSE ticket authentication.
Clarified JWT token usage.
```

## Best Practices Summary

### DO

- ✅ Use TypeScript with proper types
- ✅ Follow naming conventions
- ✅ Run Prettier before committing
- ✅ Use centralized utilities
- ✅ Write self-documenting code
- ✅ Add comments for complex logic
- ✅ Write descriptive test names
- ✅ Use ESLint and fix warnings

### DON'T

- ❌ Use `any` without justification
- ❌ Hardcode magic numbers or strings
- ❌ Skip error handling
- ❌ Write overly clever code
- ❌ Commit code with linting errors
- ❌ Skip tests for new features
- ❌ Use inconsistent naming

## Tools Setup

### VS Code

Install recommended extensions:

- **ESLint** - dbaeumer.vscode-eslint
- **Prettier** - esbenp.prettier-vscode
- **EditorConfig** - editorconfig.editorconfig

Configure workspace settings:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### Pre-commit Hooks

Consider using Husky for pre-commit hooks:

```bash
# Install Husky
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm run format"
```

## Related Documentation

- [Backend Development](./backend.md) - Backend development guide
- [Frontend Development](./frontend.md) - Frontend development guide
- [Testing Guide](./testing.md) - Testing strategies
- [Contributing Guide](./contributing.md) - Contribution workflow
