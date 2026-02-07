/**
 * Formatting Utilities
 *
 * Common formatting functions for human-readable output.
 */

/**
 * Format bytes to human-readable string
 *
 * @param bytes - Number of bytes (can be negative for deltas)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.50 GB", "256.00 MB")
 *
 * @example
 * formatBytes(1536) // "1.50 KB"
 * formatBytes(1073741824) // "1.00 GB"
 * formatBytes(-5242880) // "-5.00 MB"
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

  // Handle negative numbers (for deltas)
  const sign = bytes < 0 ? '-' : '';
  const absValue = Math.abs(bytes);

  return `${sign}${(absValue / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}
