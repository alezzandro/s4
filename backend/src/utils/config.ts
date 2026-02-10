import { S3Client } from '@aws-sdk/client-s3';
import { NodeJsClient } from '@smithy/types';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getApplyMd5BodyChecksumPlugin } from '@aws-sdk/middleware-apply-body-checksum';
import http from 'http';
import https from 'https';
import { createLogger } from './logger';
import { PAGE_SIZE_PRESETS, snapToNearestPreset } from './paginationPresets';

// Module-level logger for config utilities
const logger = createLogger(undefined, '[Config]');

// Initial configuration - S4 defaults to local zgw S3 engine
let accessKeyId = process.env.AWS_ACCESS_KEY_ID || 's4admin';
let secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || 's4secret';
let region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
let endpoint = process.env.AWS_S3_ENDPOINT || 'http://localhost:7480';
let defaultBucket = process.env.AWS_S3_BUCKET || '';
let hfToken = process.env.HF_TOKEN || '';
let maxConcurrentTransfers = parseInt(process.env.MAX_CONCURRENT_TRANSFERS || '2', 10);
let maxFilesPerPage = parseInt(process.env.MAX_FILES_PER_PAGE || '100', 10);
if (!PAGE_SIZE_PRESETS.includes(maxFilesPerPage as (typeof PAGE_SIZE_PRESETS)[number])) {
  const snapped = snapToNearestPreset(maxFilesPerPage);
  logger.warn(
    { original: maxFilesPerPage, snapped },
    'MAX_FILES_PER_PAGE is not a valid preset value, snapping to nearest preset',
  );
  maxFilesPerPage = snapped;
}
let httpProxy = process.env.HTTP_PROXY || '';
let httpsProxy = process.env.HTTPS_PROXY || '';

// Parse LOCAL_STORAGE_PATHS from environment
// Default: empty array (local storage disabled unless explicitly configured)
let localStoragePaths: string[] = process.env.LOCAL_STORAGE_PATHS
  ? process.env.LOCAL_STORAGE_PATHS.split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
  : []; // No local storage by default - must be explicitly configured

// Parse MAX_FILE_SIZE_GB from environment
// Default: 20GB
let maxFileSizeGB: number = parseInt(process.env.MAX_FILE_SIZE_GB || '20', 10);

// Validate maxFileSizeGB
if (isNaN(maxFileSizeGB) || maxFileSizeGB <= 0) {
  logger.warn({ value: process.env.MAX_FILE_SIZE_GB, default: 20 }, 'Invalid MAX_FILE_SIZE_GB, using default');
  maxFileSizeGB = 20;
}

/**
 * Initialize and configure AWS S3 client
 *
 * Creates a new S3Client instance with:
 * - Connection pooling and keep-alive for performance
 * - Retry logic with exponential backoff (5 attempts, adaptive mode)
 * - HTTP/HTTPS proxy support (if configured)
 * - MD5 checksum middleware for Minio compatibility
 * - Custom timeouts (5s connection, 5min request)
 *
 * Connection Pooling Configuration:
 * - Keep-alive enabled with 1s probe interval
 * - Max 10 concurrent connections
 * - Max 5 idle connections
 * - 30s socket timeout
 *
 * Minio Compatibility:
 * - Applies MD5 body checksum plugin for DELETE operations
 * - Minio requires Content-MD5 header for bulk delete operations
 *
 * @returns Configured S3Client instance ready for use
 *
 * @example
 * ```typescript
 * // Client is automatically initialized on module load
 * // But can be manually reinitialized if needed:
 * const client = initializeS3Client();
 * const response = await client.send(new ListBucketsCommand({}));
 * ```
 */
export const initializeS3Client = (): S3Client => {
  const s3ClientOptions: any = {
    region: region,
    endpoint: endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
    // AWS SDK retry configuration
    maxAttempts: 5, // Retry up to 5 times
    retryMode: 'adaptive', // Adaptive retry mode with exponential backoff
  };

  // HTTP agent configuration for connection pooling and keep-alive
  const agentOptions: http.AgentOptions = {
    keepAlive: true, // Reuse TCP connections
    keepAliveMsecs: 1000, // Send keep-alive probes every 1 second
    maxSockets: 10, // Allow up to 10 concurrent connections
    maxFreeSockets: 5, // Keep up to 5 idle connections
    timeout: 30000, // 30 second socket timeout
  };

  const agentConfig: {
    httpAgent?: HttpProxyAgent<string> | http.Agent;
    httpsAgent?: HttpsProxyAgent<string> | https.Agent;
  } = {};

  // Configure HTTP agent (proxy or regular)
  if (httpProxy) {
    try {
      agentConfig.httpAgent = new HttpProxyAgent<string>(httpProxy);
    } catch (e) {
      logger.error({ error: e }, 'Failed to create HttpProxyAgent');
    }
  } else {
    agentConfig.httpAgent = new http.Agent(agentOptions);
  }

  // Configure HTTPS agent (proxy or regular)
  if (httpsProxy) {
    try {
      agentConfig.httpsAgent = new HttpsProxyAgent<string>(httpsProxy);
    } catch (e) {
      logger.error({ error: e }, 'Failed to create HttpsProxyAgent');
    }
  } else {
    agentConfig.httpsAgent = new https.Agent(agentOptions);
  }

  // Always configure request handler with connection pooling and timeouts
  s3ClientOptions.requestHandler = new NodeHttpHandler({
    connectionTimeout: 5000, // 5 second connection timeout
    requestTimeout: 300000, // 5 minute request timeout (for large files)
    httpAgent: agentConfig.httpAgent,
    httpsAgent: agentConfig.httpsAgent,
  });

  const client = new S3Client(s3ClientOptions) as NodeJsClient<S3Client>;

  // Apply MD5 checksum middleware for Minio compatibility
  // Minio requires Content-MD5 header for DELETE operations (both single and bulk)
  // This middleware automatically adds Content-MD5 to operations that support it
  client.middlewareStack.use(getApplyMd5BodyChecksumPlugin(client.config));

  return client;
};

let s3Client = initializeS3Client();

/**
 * Update S3 configuration at runtime
 *
 * Updates the S3 client configuration and reinitializes the client with
 * new settings. This allows runtime configuration changes without restarting
 * the server.
 *
 * IMPORTANT: This reinitializes the S3 client, which may interrupt ongoing
 * operations. Ensure no active transfers are running before calling.
 *
 * @param newAccessKeyId - AWS access key ID
 * @param newSecretAccessKey - AWS secret access key
 * @param newRegion - AWS region (e.g., 'us-east-1')
 * @param newEndpoint - S3 endpoint URL (e.g., 'http://localhost:7480')
 * @param newDefaultBucket - Default bucket name (optional)
 *
 * @example
 * ```typescript
 * // Update S3 config from settings form
 * updateS3Config(
 *   's4admin',
 *   's4secret',
 *   'us-east-1',
 *   'http://localhost:7480',
 *   'my-bucket'
 * );
 *
 * // New config takes effect immediately
 * const config = getS3Config();
 * console.log(`Updated endpoint: ${config.endpoint}`);
 * ```
 */
export const updateS3Config = (
  newAccessKeyId: string,
  newSecretAccessKey: string,
  newRegion: string,
  newEndpoint: string,
  newDefaultBucket: string,
): void => {
  accessKeyId = newAccessKeyId;
  secretAccessKey = newSecretAccessKey;
  region = newRegion;
  endpoint = newEndpoint;
  defaultBucket = newDefaultBucket;

  // Reinitialize the S3 client
  s3Client = initializeS3Client();
};

/**
 * Get current S3 configuration settings
 *
 * Returns the active S3 client configuration including credentials,
 * endpoint, and region settings. This is the runtime configuration
 * that may have been updated via updateS3Config().
 *
 * @returns S3 configuration object containing:
 *   - accessKeyId: AWS access key ID
 *   - secretAccessKey: AWS secret access key
 *   - region: AWS region
 *   - endpoint: S3 endpoint URL
 *   - defaultBucket: Default bucket name (may be empty)
 *   - s3Client: Configured S3Client instance
 *
 * @example
 * ```typescript
 * const config = getS3Config();
 * console.log(`Connected to: ${config.endpoint}`);
 *
 * // Use the client directly
 * const response = await config.s3Client.send(new ListBucketsCommand({}));
 * ```
 */
export const getS3Config = (): any => {
  return {
    accessKeyId,
    secretAccessKey,
    region,
    endpoint,
    defaultBucket,
    s3Client,
  };
};

/**
 * Get current HuggingFace token
 *
 * Returns the HuggingFace API token used for model downloads.
 * Configured via HF_TOKEN environment variable.
 *
 * @returns HuggingFace token string (empty if not configured)
 *
 * @example
 * ```typescript
 * const token = getHFConfig();
 * if (token) {
 *   console.log('HuggingFace authentication enabled');
 * }
 * ```
 */
export const getHFConfig = (): string => {
  return hfToken;
};

/**
 * Update HuggingFace token at runtime
 *
 * Updates the HuggingFace API token for authenticated model downloads.
 *
 * @param newHfToken - New HuggingFace API token (can be empty to disable)
 *
 * @example
 * ```typescript
 * // Enable HuggingFace authentication
 * updateHFConfig('hf_xxxxxxxxxxxxxxxxxxxx');
 *
 * // Disable HuggingFace authentication
 * updateHFConfig('');
 * ```
 */
export const updateHFConfig = (newHfToken: string): void => {
  hfToken = newHfToken;
};

/**
 * Get HTTP/HTTPS proxy configuration
 *
 * Returns the current proxy settings used for S3 client connections.
 * Proxy settings can be configured via HTTP_PROXY and HTTPS_PROXY
 * environment variables or updated at runtime via updateProxyConfig().
 *
 * @returns Proxy configuration object with httpProxy and httpsProxy URLs
 *   - httpProxy: HTTP proxy URL (empty string if not configured)
 *   - httpsProxy: HTTPS proxy URL (empty string if not configured)
 *
 * @example
 * ```typescript
 * const proxy = getProxyConfig();
 * if (proxy.httpsProxy) {
 *   console.log(`Using HTTPS proxy: ${proxy.httpsProxy}`);
 * }
 * ```
 */
export const getProxyConfig = (): { httpProxy: string; httpsProxy: string } => {
  return {
    httpProxy,
    httpsProxy,
  };
};

/**
 * Update HTTP/HTTPS proxy configuration at runtime
 *
 * Updates proxy settings and reinitializes the S3 client to use the new
 * proxy configuration. Empty strings disable proxy for that protocol.
 *
 * IMPORTANT: This reinitializes the S3 client, which may interrupt ongoing
 * operations. Ensure no active transfers are running before calling.
 *
 * @param newHttpProxy - HTTP proxy URL (e.g., 'http://proxy.example.com:8080') or empty string to disable
 * @param newHttpsProxy - HTTPS proxy URL (e.g., 'http://proxy.example.com:8080') or empty string to disable
 *
 * @example
 * ```typescript
 * // Enable proxy for enterprise environment
 * updateProxyConfig(
 *   'http://proxy.corp.example.com:8080',
 *   'http://proxy.corp.example.com:8080'
 * );
 *
 * // Disable proxy
 * updateProxyConfig('', '');
 * ```
 */
export const updateProxyConfig = (newHttpProxy: string, newHttpsProxy: string): void => {
  httpProxy = newHttpProxy;
  httpsProxy = newHttpsProxy;
  // Reinitialize clients that depend on proxy settings
  s3Client = initializeS3Client();
};

/**
 * Get maximum concurrent transfer limit
 *
 * Returns the maximum number of simultaneous file transfers allowed.
 * Used with p-limit to control concurrency in transfer operations.
 *
 * Default: 2 concurrent transfers
 * Configurable via: MAX_CONCURRENT_TRANSFERS environment variable
 *
 * @returns Maximum number of concurrent transfers
 *
 * @example
 * ```typescript
 * import pLimit from 'p-limit';
 * const limit = pLimit(getMaxConcurrentTransfers());
 *
 * // Apply to transfer operations
 * await limit(() => transferFile(source, dest));
 * ```
 */
export const getMaxConcurrentTransfers = (): number => {
  return maxConcurrentTransfers;
};

/**
 * Update maximum concurrent transfer limit at runtime
 *
 * Changes the number of simultaneous file transfers allowed.
 * Higher values increase throughput but consume more memory and network resources.
 *
 * Recommended values:
 * - Low memory systems: 1-2
 * - Normal systems: 2-4
 * - High performance: 4-8
 *
 * @param newMaxConcurrentTransfers - New limit (must be positive integer)
 *
 * @example
 * ```typescript
 * // Increase concurrency for large batch transfer
 * updateMaxConcurrentTransfers(5);
 *
 * // Reduce for low-memory environment
 * updateMaxConcurrentTransfers(1);
 * ```
 */
export const updateMaxConcurrentTransfers = (newMaxConcurrentTransfers: number): void => {
  maxConcurrentTransfers = newMaxConcurrentTransfers;
};

/**
 * Get maximum files per page limit
 *
 * Returns the pagination limit for file listing operations.
 * Used to control the number of files returned in a single page.
 *
 * Default: 100 files per page
 * Configurable via: MAX_FILES_PER_PAGE environment variable
 *
 * @returns Maximum number of files per page
 *
 * @example
 * ```typescript
 * const pageSize = getMaxFilesPerPage();
 * const files = await listFiles({ limit: pageSize });
 * ```
 */
export const getMaxFilesPerPage = (): number => {
  return maxFilesPerPage;
};

/**
 * Update maximum files per page limit at runtime
 *
 * Changes the pagination limit for file listing operations.
 * Higher values reduce API calls but may impact performance and memory usage.
 *
 * @param newMaxFilesPerPage - New limit (must be positive integer)
 *
 * @example
 * ```typescript
 * // Increase page size for better performance
 * updateMaxFilesPerPage(200);
 *
 * // Reduce page size for low-memory environment
 * updateMaxFilesPerPage(50);
 * ```
 */
export const updateMaxFilesPerPage = (newMaxFilesPerPage: number): void => {
  maxFilesPerPage = newMaxFilesPerPage;
};

/**
 * Get configured local storage paths
 * @returns Array of filesystem paths that can be used for local storage
 */
export const getLocalStoragePaths = (): string[] => {
  return [...localStoragePaths]; // Return copy to prevent mutation
};

/**
 * Get maximum file size limit in GB
 * @returns Maximum file size in gigabytes
 */
export const getMaxFileSizeGB = (): number => {
  return maxFileSizeGB;
};

/**
 * Get maximum file size limit in bytes
 * @returns Maximum file size in bytes
 */
export const getMaxFileSizeBytes = (): number => {
  return maxFileSizeGB * 1024 * 1024 * 1024;
};

/**
 * Update local storage paths at runtime (for testing or runtime configuration)
 * @param newPaths - Array of filesystem paths
 */
export const updateLocalStoragePaths = (newPaths: string[]): void => {
  localStoragePaths = newPaths.filter((p) => p.trim().length > 0);
};

/**
 * Update maximum file size limit at runtime
 * @param newLimitGB - New limit in gigabytes
 */
export const updateMaxFileSizeGB = (newLimitGB: number): void => {
  if (newLimitGB > 0 && !isNaN(newLimitGB)) {
    maxFileSizeGB = newLimitGB;
  } else {
    throw new Error(`Invalid file size limit: ${newLimitGB}`);
  }
};

/**
 * Validate a file size against the configured limit
 * @param sizeBytes - File size in bytes
 * @returns true if file size is within limit
 */
export const isFileSizeValid = (sizeBytes: number): boolean => {
  return sizeBytes <= getMaxFileSizeBytes();
};

/**
 * Format file size for error messages
 * @param sizeBytes - File size in bytes
 * @returns Formatted string (e.g., "25.5 GB")
 */
export const formatFileSize = (sizeBytes: number): string => {
  const gb = sizeBytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = sizeBytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }
  const kb = sizeBytes / 1024;
  return `${kb.toFixed(2)} KB`;
};
