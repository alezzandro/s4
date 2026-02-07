# Contributing Guide

Thank you for your interest in contributing to S4! This guide will help you get started.

## Code of Conduct

Be respectful, collaborative, and professional. We welcome contributions from everyone.

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/s4.git
cd s4

# Add upstream remote
git remote add upstream https://github.com/rh-aiservices-bu/s4.git
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/my-feature

# Or bugfix branch
git checkout -b fix/my-bugfix
```

## Development Workflow

### 1. Make Changes

```bash
# Start development servers
npm run dev

# Make your changes
# Test locally
```

### 2. Run Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Format code
npm run format
```

### 3. Commit Changes

Follow these commit message conventions:

```bash
# Format: <type>(<scope>): <subject>
#
# Examples:
git commit -m "feat(backend): add bucket tagging support"
git commit -m "fix(frontend): resolve modal close issue"
git commit -m "docs(api): update authentication examples"
git commit -m "test(backend): add tests for transfer endpoints"
git commit -m "chore(deps): update PatternFly to 6.3.0"
```

#### Commit Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `test` - Adding or updating tests
- `refactor` - Code refactoring (no functionality change)
- `style` - Code style changes (formatting, missing semicolons)
- `chore` - Maintenance tasks (dependencies, build config)
- `perf` - Performance improvements
- `ci` - CI/CD changes

#### Commit Scopes

- `backend` - Backend changes
- `frontend` - Frontend changes
- `api` - API changes
- `docs` - Documentation changes
- `deps` - Dependency updates
- `docker` - Container changes
- `k8s` - Kubernetes changes

### 4. Push Changes

```bash
git push origin feature/my-feature
```

### 5. Create Pull Request

1. Go to GitHub and create a Pull Request
2. Fill out the PR template
3. Wait for review and address feedback

## Pull Request Guidelines

### PR Title

Use the same format as commit messages:

```
feat(backend): add bucket tagging support
fix(frontend): resolve modal close issue
```

### PR Description

Include:

1. **What** - What does this PR do?
2. **Why** - Why is this change needed?
3. **How** - How does this implement the change?
4. **Testing** - How was this tested?
5. **Screenshots** - If UI changes, include screenshots

**Example**:

```markdown
## What

Adds support for S3 bucket tagging in the backend API and frontend UI.

## Why

Users need the ability to organize buckets using tags for better management and cost allocation.

## How

- Added `PUT /api/buckets/:bucketName/tags` endpoint
- Added `GET /api/buckets/:bucketName/tags` endpoint
- Implemented TagsModal component in frontend
- Updated StorageBrowser to display tags

## Testing

- Added backend tests for tag endpoints
- Added frontend tests for TagsModal
- Manually tested tag creation, update, and deletion
- Verified tag display in bucket list

## Screenshots

![Tag modal](./screenshots/tag-modal.png)
```

### PR Checklist

Before submitting a PR, ensure:

- [ ] Code follows the [code style guide](./code-style.md)
- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] New features have tests
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] PR description is complete

## Code Review Process

### What to Expect

1. **Initial Review** - A maintainer will review within 2-3 business days
2. **Feedback** - You may receive requests for changes
3. **Iteration** - Address feedback and push updates
4. **Approval** - Once approved, your PR will be merged

### Addressing Feedback

```bash
# Make requested changes
# Commit with descriptive message
git add .
git commit -m "refactor(backend): simplify error handling per review"

# Push updates
git push origin feature/my-feature
```

### Review Guidelines

Reviewers will check:

- **Functionality** - Does it work as expected?
- **Code Quality** - Is it clean and maintainable?
- **Testing** - Are there adequate tests?
- **Documentation** - Is it documented?
- **Performance** - Are there any performance concerns?
- **Security** - Are there any security issues?

## Types of Contributions

### Bug Fixes

1. Create an issue describing the bug
2. Wait for confirmation or start working on a fix
3. Create a PR with the fix and tests

### New Features

1. Create an issue to discuss the feature
2. Wait for approval before starting work
3. Implement the feature with tests and documentation
4. Create a PR

### Documentation

1. Find outdated or missing documentation
2. Make improvements
3. Create a PR with documentation updates

### Code Quality

1. Identify areas for improvement
2. Refactor code with tests
3. Create a PR explaining the benefits

## Development Guidelines

### Backend

Follow the [backend development guide](./backend.md):

- Use Fastify plugin pattern
- Stream all file operations
- Use centralized error handlers
- Use TypedRequest for type safety
- Apply validation schemas
- Include tests for new endpoints

### Frontend

Follow the [frontend development guide](./frontend.md):

- Use PatternFly 6 components (`pf-v6-` prefix)
- Use semantic design tokens (`--pf-t--`)
- Use notification utilities for user feedback
- Use validation utilities for input validation
- Use custom hooks (`useModal`, `useStorageLocations`)
- Include tests for new components

### Testing

Follow the [testing guide](./testing.md):

- Write tests for new features
- Test both success and error cases
- Use appropriate mocking
- Maintain or improve coverage

## Communication

### Issues

- **Bug Reports** - Use the bug report template
- **Feature Requests** - Use the feature request template
- **Questions** - Use GitHub Discussions

### Discussions

- **General Questions** - GitHub Discussions
- **Design Proposals** - GitHub Discussions
- **Community Chat** - (Add link if available)

## Recognition

Contributors are recognized in:

- GitHub Contributors page
- Release notes for significant contributions
- Project documentation

## Common Pitfalls

### Backend

- ❌ Loading entire files into memory (use streaming)
- ❌ Skipping error handling for S3 operations
- ❌ Type casting request parameters (`as any`)
- ❌ Hardcoding HTTP status codes

### Frontend

- ❌ Using PatternFly 5 classes (must use `pf-v6-`)
- ❌ Hardcoding colors or spacing (use design tokens)
- ❌ Creating manual modal state (use `useModal` hook)
- ❌ Skipping accessibility features

### General

- ❌ Not running tests before committing
- ❌ Not formatting code before committing
- ❌ Committing `node_modules` or build artifacts
- ❌ Large PRs that change too many things

## Getting Help

If you need help:

1. Check the [documentation](../README.md)
2. Search existing [issues](https://github.com/rh-aiservices-bu/s4/issues)
3. Ask in [GitHub Discussions](https://github.com/rh-aiservices-bu/s4/discussions)
4. Reach out to maintainers

## License

By contributing to S4, you agree that your contributions will be licensed under the Apache 2.0 License.

## Thank You!

Your contributions make S4 better for everyone. Thank you for taking the time to contribute!

## Related Documentation

- [Development Setup](./README.md) - Getting started with development
- [Backend Development](./backend.md) - Backend development guide
- [Frontend Development](./frontend.md) - Frontend development guide
- [Testing Guide](./testing.md) - Testing strategies
- [Code Style Guide](./code-style.md) - Coding standards
