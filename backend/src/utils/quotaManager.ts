import { formatBytes } from './formatting';

interface Quota {
  maxStorageBytes: number;
  maxFileCount: number;
  currentStorageBytes: number;
  currentFileCount: number;
}

// In-memory quota store (use database in production)
const quotaStore = new Map<string, Quota>();

// Default quota limits
const DEFAULT_MAX_STORAGE_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB
const DEFAULT_MAX_FILE_COUNT = 10000;

/**
 * Initialize quota tracking for a storage location
 *
 * Creates quota entry with default limits if not already initialized.
 * Safe to call multiple times - only initializes on first call.
 *
 * Default Limits:
 * - Storage: 100 GB (configurable in production)
 * - File count: 10,000 files (configurable in production)
 *
 * Initial State:
 * - Current storage: 0 bytes
 * - Current file count: 0 files
 *
 * IMPORTANT: Quota data is stored in-memory and will be lost on restart.
 * For production, use a database-backed quota store.
 *
 * @param locationId - Unique identifier for the storage location (e.g., 's3:bucket-name' or 'local:/path')
 *
 * @example
 * ```typescript
 * // Initialize quota before first operation
 * initializeQuota('s3:my-bucket');
 *
 * // Safe to call multiple times
 * initializeQuota('s3:my-bucket'); // No-op if already initialized
 * ```
 */
export function initializeQuota(locationId: string): void {
  if (!quotaStore.has(locationId)) {
    quotaStore.set(locationId, {
      maxStorageBytes: DEFAULT_MAX_STORAGE_BYTES,
      maxFileCount: DEFAULT_MAX_FILE_COUNT,
      currentStorageBytes: 0,
      currentFileCount: 0,
    });
  }
}

/**
 * Check if operation would exceed quota limits
 *
 * Validates that a proposed operation (file upload, directory copy, etc.)
 * will not exceed storage or file count quotas. Auto-initializes quota
 * if not already tracked.
 *
 * Quota Checks:
 * 1. Storage quota: currentBytes + additionalBytes <= maxStorageBytes
 * 2. File count quota: currentFiles + additionalFiles <= maxFileCount
 *
 * Use this BEFORE performing operations to prevent quota violations.
 * Call updateQuota() AFTER successful operations to track usage.
 *
 * @param locationId - Unique identifier for the storage location
 * @param additionalBytes - Number of bytes the operation will add (can be 0 for file count-only checks)
 * @param additionalFiles - Number of files the operation will add (can be 0 for storage-only checks)
 * @returns Object with allowed flag and optional reason:
 *   - allowed: true if operation is within quota
 *   - allowed: false with reason string if quota would be exceeded
 *
 * @example
 * ```typescript
 * // Check before file upload
 * const result = checkQuota('s3:my-bucket', fileSize, 1);
 * if (!result.allowed) {
 *   return reply.code(507).send({ error: result.reason });
 * }
 *
 * // Proceed with upload...
 * await uploadFile(file);
 *
 * // Update quota after success
 * updateQuota('s3:my-bucket', fileSize, 1);
 * ```
 *
 * @example
 * ```typescript
 * // Check before bulk directory copy (500 files, 2.5 GB)
 * const result = checkQuota('local:/data', 2.5 * 1024 * 1024 * 1024, 500);
 * if (!result.allowed) {
 *   console.error(`Quota check failed: ${result.reason}`);
 * }
 * ```
 */
export function checkQuota(
  locationId: string,
  additionalBytes: number,
  additionalFiles: number,
): { allowed: boolean; reason?: string } {
  initializeQuota(locationId);
  const quota = quotaStore.get(locationId)!;

  if (quota.currentStorageBytes + additionalBytes > quota.maxStorageBytes) {
    const remaining = quota.maxStorageBytes - quota.currentStorageBytes;
    return {
      allowed: false,
      reason: `Storage quota exceeded. ${formatBytes(remaining)} remaining.`,
    };
  }

  if (quota.currentFileCount + additionalFiles > quota.maxFileCount) {
    const remaining = quota.maxFileCount - quota.currentFileCount;
    return {
      allowed: false,
      reason: `File count quota exceeded. ${remaining} files remaining.`,
    };
  }

  return { allowed: true };
}

/**
 * Update quota usage after successful operation
 *
 * Updates current storage and file count after operations complete.
 * Supports both positive changes (uploads, copies) and negative changes
 * (deletes). Auto-initializes quota if not already tracked.
 *
 * Safety Features:
 * - Prevents negative values (clamps to 0 if delete operations exceed tracked usage)
 * - Idempotent - safe to call multiple times with same values
 *
 * Typical Workflow:
 * 1. Call checkQuota() before operation
 * 2. Perform operation (upload, delete, etc.)
 * 3. Call updateQuota() after successful completion
 *
 * IMPORTANT: Only call this AFTER successful operations. If operation fails,
 * do not update quota to maintain accurate usage tracking.
 *
 * @param locationId - Unique identifier for the storage location
 * @param bytesChange - Change in storage (positive for adds, negative for deletes)
 * @param filesChange - Change in file count (positive for adds, negative for deletes)
 *
 * @example
 * ```typescript
 * // After successful file upload
 * updateQuota('s3:my-bucket', 1048576, 1); // +1 MB, +1 file
 *
 * // After successful file deletion
 * updateQuota('s3:my-bucket', -2097152, -1); // -2 MB, -1 file
 *
 * // After successful directory copy (500 files, 2.5 GB)
 * updateQuota('local:/data', 2.5 * 1024 * 1024 * 1024, 500);
 * ```
 */
export function updateQuota(locationId: string, bytesChange: number, filesChange: number): void {
  initializeQuota(locationId);
  const quota = quotaStore.get(locationId)!;

  quota.currentStorageBytes += bytesChange;
  quota.currentFileCount += filesChange;

  // Prevent negative values
  if (quota.currentStorageBytes < 0) quota.currentStorageBytes = 0;
  if (quota.currentFileCount < 0) quota.currentFileCount = 0;
}

/**
 * Get current quota status for a storage location
 *
 * Returns a snapshot of current quota limits and usage. Safe to call
 * at any time - auto-initializes quota if not already tracked.
 *
 * Use Cases:
 * - Display quota status in UI
 * - Monitor quota usage
 * - Generate quota reports
 * - Calculate remaining capacity
 *
 * @param locationId - Unique identifier for the storage location
 * @returns Quota object containing:
 *   - maxStorageBytes: Maximum storage allowed in bytes
 *   - maxFileCount: Maximum number of files allowed
 *   - currentStorageBytes: Current storage used in bytes
 *   - currentFileCount: Current number of files
 *
 * @example
 * ```typescript
 * // Get quota status for display
 * const quota = getQuotaStatus('s3:my-bucket');
 * console.log(`Storage: ${quota.currentStorageBytes} / ${quota.maxStorageBytes} bytes`);
 * console.log(`Files: ${quota.currentFileCount} / ${quota.maxFileCount}`);
 *
 * // Calculate percentage used
 * const storagePercent = (quota.currentStorageBytes / quota.maxStorageBytes) * 100;
 * console.log(`${storagePercent.toFixed(1)}% storage used`);
 * ```
 *
 * @example
 * ```typescript
 * // Calculate remaining capacity
 * const quota = getQuotaStatus('local:/data');
 * const remainingBytes = quota.maxStorageBytes - quota.currentStorageBytes;
 * const remainingFiles = quota.maxFileCount - quota.currentFileCount;
 * console.log(`Remaining: ${formatBytes(remainingBytes)}, ${remainingFiles} files`);
 * ```
 */
export function getQuotaStatus(locationId: string): Quota {
  initializeQuota(locationId);
  return { ...quotaStore.get(locationId)! };
}
