# Error Reference

Comprehensive reference for S4 error messages, organized by category.

## Overview

This document provides a complete reference for error messages you may encounter when using S4. Each error includes:

- **Error message** - The exact text displayed
- **HTTP status** - The HTTP status code returned
- **Cause** - Why this error occurs
- **Resolution** - Steps to fix the issue

---

## Authentication Errors

Errors related to login, JWT tokens, and session management.

### Authentication is not enabled

| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| **HTTP Status** | 400 Bad Request                                                                     |
| **Cause**       | Attempting to log in when authentication is disabled                                |
| **Resolution**  | Authentication is not required. Access the application directly without logging in. |

### Too many login attempts. Maximum 5 per minute.

| Field           | Value                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **HTTP Status** | 429 Too Many Requests                                                                                                          |
| **Cause**       | Exceeded the rate limit of 5 login attempts per minute                                                                         |
| **Resolution**  | Wait at least 1 minute before attempting to log in again. The `retryAfter` field in the response indicates when you can retry. |

### Username and password are required

| Field           | Value                                                 |
| --------------- | ----------------------------------------------------- |
| **HTTP Status** | 400 Bad Request                                       |
| **Cause**       | Login request missing username or password            |
| **Resolution**  | Provide both username and password in the login form. |

### Invalid username or password

| Field           | Value                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 401 Unauthorized                                                                                                        |
| **Cause**       | The provided credentials do not match the configured user                                                               |
| **Resolution**  | Verify you're using the correct username and password. Contact your administrator if you've forgotten your credentials. |

### Authentication required

| Field           | Value                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 401 Unauthorized                                                                                   |
| **Cause**       | Attempting to access a protected endpoint without a valid JWT token                                |
| **Resolution**  | Log in to obtain a valid token, or ensure your Authorization header includes a valid Bearer token. |

### Token has expired

| Field           | Value                                                             |
| --------------- | ----------------------------------------------------------------- |
| **HTTP Status** | 401 Unauthorized                                                  |
| **Cause**       | The JWT token has exceeded its expiration time (default: 8 hours) |
| **Resolution**  | Log in again to obtain a new token.                               |

### Invalid or expired ticket

| Field           | Value                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 401 Unauthorized                                                                                            |
| **Cause**       | SSE (Server-Sent Events) ticket is invalid, expired, or already used                                        |
| **Resolution**  | Request a new ticket via `/api/auth/sse-ticket`. Tickets expire after 60 seconds and can only be used once. |

### Resource and resourceType are required

| Field           | Value                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 400 Bad Request                                                                                                        |
| **Cause**       | SSE ticket request missing required fields                                                                             |
| **Resolution**  | Include both `resource` (e.g., job ID or encoded key) and `resourceType` ("transfer" or "upload") in the request body. |

---

## Rate Limiting Errors

Errors related to exceeding request rate limits.

### Rate Limits by Endpoint

| Endpoint                                  | Limit       | Window   |
| ----------------------------------------- | ----------- | -------- |
| Login (`POST /api/auth/login`)            | 5 requests  | 1 minute |
| Search (`GET /api/objects` with query)    | 5 requests  | 1 minute |
| Upload (`POST /api/objects/upload`)       | 10 requests | 1 minute |
| Transfer (`POST /api/transfer`)           | 1 request   | 1 minute |
| SSE Tickets (`POST /api/auth/sse-ticket`) | 20 requests | 1 minute |

### Rate limit exceeded

| Field           | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| **HTTP Status** | 429 Too Many Requests                                                                            |
| **Cause**       | Too many requests to a rate-limited endpoint                                                     |
| **Resolution**  | Wait until the `retryAfter` time indicated in the response. Consider reducing request frequency. |

**Response Format**:

```json
{
  "error": "RateLimitExceeded",
  "message": "Too many requests. Maximum N per minute.",
  "retryAfter": 45
}
```

The `retryAfter` field indicates seconds until the rate limit resets.

---

## Storage and Bucket Errors

Errors related to S3 buckets and storage locations.

### InvalidBucketName

| Field           | Value                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 400 Bad Request                                                                                                                          |
| **Cause**       | Bucket name does not meet AWS S3 naming requirements                                                                                     |
| **Resolution**  | Ensure bucket name is 3-63 characters, uses only lowercase letters, numbers, dots, and hyphens, starts and ends with a letter or number. |

**Bucket Naming Rules**:

- 3-63 characters long
- Only lowercase letters, numbers, dots (.), and hyphens (-)
- Must start and end with a letter or number
- No consecutive periods
- Cannot be formatted as an IP address

### BucketNotFound / NoSuchBucket

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **HTTP Status** | 404 Not Found                                                             |
| **Cause**       | The specified bucket does not exist                                       |
| **Resolution**  | Verify the bucket name is correct. Create the bucket if it doesn't exist. |

### BucketAlreadyExists / BucketAlreadyOwnedByYou

| Field           | Value                                                    |
| --------------- | -------------------------------------------------------- |
| **HTTP Status** | 409 Conflict                                             |
| **Cause**       | Attempting to create a bucket that already exists        |
| **Resolution**  | Use a different bucket name, or use the existing bucket. |

### BucketNotEmpty

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **HTTP Status** | 409 Conflict                                                        |
| **Cause**       | Attempting to delete a bucket that still contains objects           |
| **Resolution**  | Delete all objects in the bucket before deleting the bucket itself. |

### AccessDenied

| Field           | Value                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 403 Forbidden                                                                                     |
| **Cause**       | Insufficient permissions to access the bucket or object                                           |
| **Resolution**  | Verify your S3 credentials have the necessary permissions. Contact your administrator for access. |

### Invalid location ID

| Field           | Value                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 404 Not Found                                                                                                                    |
| **Cause**       | The specified storage location does not exist                                                                                    |
| **Resolution**  | Use the Storage Management page to view available locations. Ensure the location ID matches an existing bucket or local storage. |

---

## File Operation Errors

Errors related to uploading, downloading, and managing files.

### Path traversal detected / Path escapes allowed directory

| Field           | Value                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| **HTTP Status** | 400 Bad Request                                                                       |
| **Cause**       | Path contains `..` or other sequences that would escape the allowed directory         |
| **Resolution**  | Use valid paths that stay within the storage location. Do not use `..` in path names. |

### File not found

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **HTTP Status** | 404 Not Found                                                             |
| **Cause**       | The specified file or object does not exist                               |
| **Resolution**  | Verify the file path is correct. The file may have been deleted or moved. |

### Permission denied

| Field           | Value                                                  |
| --------------- | ------------------------------------------------------ |
| **HTTP Status** | 403 Forbidden                                          |
| **Cause**       | Insufficient filesystem permissions to access the file |
| **Resolution**  | Contact your administrator to verify file permissions. |

### Disk full / Quota exceeded

| Field           | Value                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 507 Insufficient Storage                                                                          |
| **Cause**       | Storage volume is full or quota has been exceeded                                                 |
| **Resolution**  | Delete unnecessary files to free up space, or request additional storage from your administrator. |

### File size exceeds limit

| Field           | Value                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 413 Payload Too Large                                                                                    |
| **Cause**       | File size exceeds the configured maximum (default: 20GB)                                                 |
| **Resolution**  | Split the file into smaller parts, or request an increase to `MAX_FILE_SIZE_GB` from your administrator. |

### Invalid object name

| Field           | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| **HTTP Status** | 400 Bad Request                                                                  |
| **Cause**       | Object/file name contains invalid characters                                     |
| **Resolution**  | Avoid using `.` or `..` as names, paths starting with `../`, or null characters. |

### InvalidPrefix

| Field           | Value                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| **HTTP Status** | 400 Bad Request                                                                            |
| **Cause**       | The prefix parameter contains invalid characters or encoding                               |
| **Resolution**  | Ensure the prefix is properly Base64-encoded and doesn't contain path traversal sequences. |

### InvalidContinuationToken

| Field           | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| **HTTP Status** | 400 Bad Request                                             |
| **Cause**       | The pagination token is invalid or has expired              |
| **Resolution**  | Start a new listing operation without a continuation token. |

---

## Transfer Errors

Errors related to file transfer operations between storage locations.

### Missing required fields

| Field           | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| **HTTP Status** | 400 Bad Request                                                          |
| **Cause**       | Transfer request is missing source, destination, or items                |
| **Resolution**  | Ensure the request includes `source`, `destination`, and `items` fields. |

### No files to transfer

| Field           | Value                                            |
| --------------- | ------------------------------------------------ |
| **HTTP Status** | 400 Bad Request                                  |
| **Cause**       | The items array in the transfer request is empty |
| **Resolution**  | Select at least one file or folder to transfer.  |

### Transfer job not found

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **HTTP Status** | 404 Not Found                                                             |
| **Cause**       | The specified transfer job ID does not exist                              |
| **Resolution**  | Verify the job ID is correct. Transfer jobs are removed after completion. |

### Transfer cancelled

| Field           | Value                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| **HTTP Status** | 200 OK (in progress events)                                                     |
| **Cause**       | The user cancelled the transfer operation                                       |
| **Resolution**  | This is an expected status when a user cancels. Start a new transfer if needed. |

### Invalid transfer path format

| Field           | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| **HTTP Status** | 500 Internal Server Error                                                                |
| **Cause**       | Internal error parsing source or destination path                                        |
| **Resolution**  | Verify source and destination locations are valid. Try refreshing the page and retrying. |

### Unsupported transfer combination

| Field           | Value                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| **HTTP Status** | 400 Bad Request                                                        |
| **Cause**       | The source and destination storage types don't support direct transfer |
| **Resolution**  | Currently supported: S3→S3, S3→Local, Local→S3, Local→Local.           |

### Conflict Resolution Errors

When files already exist at the destination:

| Resolution Mode | Behavior                                      |
| --------------- | --------------------------------------------- |
| **skip**        | File is skipped, status shows as "skipped"    |
| **overwrite**   | Existing file is replaced                     |
| **rename**      | New file gets a suffix (e.g., `file (1).txt`) |

---

## Connection and Configuration Errors

Errors related to S3 connections, proxies, and configuration.

### S3 connection failed

| Field           | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 500 Internal Server Error                                                                            |
| **Cause**       | Unable to connect to the S3 endpoint                                                                 |
| **Resolution**  | Verify the S3 endpoint URL is correct and accessible. Check network connectivity and firewall rules. |

### Invalid credentials / SignatureDoesNotMatch

| Field           | Value                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| **HTTP Status** | 403 Forbidden                                                                           |
| **Cause**       | S3 access key or secret key is invalid                                                  |
| **Resolution**  | Verify your S3 credentials in Settings. Ensure there are no extra spaces or characters. |

### Proxy connection failed

| Field           | Value                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **HTTP Status** | 500 Internal Server Error                                                                       |
| **Cause**       | Unable to connect through the configured HTTP/HTTPS proxy                                       |
| **Resolution**  | Verify proxy URLs are correct. Test proxy connectivity using the Test Proxy button in Settings. |

### Configuration validation failed

| Field           | Value                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 400 Bad Request                                                                                       |
| **Cause**       | Invalid configuration values provided                                                                 |
| **Resolution**  | Review the configuration values. Ensure URLs are properly formatted and required fields are provided. |

### Invalid file size limit

| Field           | Value                                            |
| --------------- | ------------------------------------------------ |
| **HTTP Status** | 400 Bad Request                                  |
| **Cause**       | The file size limit value is invalid             |
| **Resolution**  | Ensure the file size limit is a positive number. |

---

## HuggingFace Import Errors

Errors related to importing models from HuggingFace Hub.

### HuggingFace token required

| Field           | Value                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 401 Unauthorized                                                                                                    |
| **Cause**       | Attempting to access a gated or private model without an HF token                                                   |
| **Resolution**  | Add your HuggingFace token in Settings → HuggingFace. Ensure you've accepted the model's license on huggingface.co. |

### Authorization failed / Access to model denied

| Field           | Value                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP Status** | 403 Forbidden                                                                                                                                |
| **Cause**       | Token doesn't have permission to access the model                                                                                            |
| **Resolution**  | 1. Verify the token has "Read" permissions. 2. Accept the model's license on HuggingFace Hub. 3. Wait a few minutes for access to propagate. |

### Model not found

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **HTTP Status** | 404 Not Found                                                       |
| **Cause**       | The specified model ID doesn't exist on HuggingFace Hub             |
| **Resolution**  | Verify the model ID is correct (format: `organization/model-name`). |

### Rate limited by HuggingFace

| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| **HTTP Status** | 429 Too Many Requests                                                               |
| **Cause**       | HuggingFace Hub rate limit exceeded                                                 |
| **Resolution**  | Wait before retrying. Consider using an authenticated token for higher rate limits. |

---

## HTTP Status Code Reference

Quick reference for HTTP status codes used in S4:

| Code | Name                  | Meaning                                  |
| ---- | --------------------- | ---------------------------------------- |
| 200  | OK                    | Request successful                       |
| 201  | Created               | Resource created successfully            |
| 207  | Multi-Status          | Batch operation with mixed results       |
| 400  | Bad Request           | Invalid request parameters               |
| 401  | Unauthorized          | Authentication required or failed        |
| 403  | Forbidden             | Permission denied                        |
| 404  | Not Found             | Resource doesn't exist                   |
| 409  | Conflict              | Resource conflict (e.g., already exists) |
| 413  | Payload Too Large     | File exceeds size limit                  |
| 429  | Too Many Requests     | Rate limit exceeded                      |
| 500  | Internal Server Error | Server-side error                        |
| 507  | Insufficient Storage  | Storage capacity exceeded                |

---

## Getting Help

If you encounter an error not listed here:

1. **Check the browser console** for additional error details
2. **Review the application logs** (`kubectl logs` or `podman logs`)
3. **Check the [Troubleshooting Guide](./troubleshooting.md)** for common issues
4. **Check the [FAQ](./faq.md)** for frequently asked questions
5. **Report the issue** on [GitHub Issues](https://github.com/rh-aiservices-bu/s4/issues)

When reporting issues, include:

- The exact error message
- Steps to reproduce the issue
- S4 version and deployment method
- Relevant configuration (without credentials)

---

## Related Documentation

- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
- [Monitoring Guide](./monitoring.md) - Monitoring and observability
- [User Guide](../user-guide/README.md) - Complete user documentation
- [Configuration Reference](../deployment/configuration.md) - Environment variables
