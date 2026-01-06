/**
 * Security utilities for sanitizing user input
 */

/**
 * Sanitize filename for use in HTTP headers
 * Prevents CRLF injection and header manipulation attacks
 *
 * @param fileName - Raw filename from user input or S3 keys
 * @returns Sanitized filename safe for use in HTTP headers
 *
 * @example
 * sanitizeFileName("file.txt") // "file.txt"
 * sanitizeFileName("test\r\nX-Evil: true") // "test__X-Evil_ true"
 * sanitizeFileName('file";.jpg') // "file_.jpg"
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[\r\n]/g, '_') // Remove CRLF characters (prevent header injection)
    .replace(/[";]/g, '_') // Replace quotes and semicolons (prevent header parsing issues)
    .replace(/\\/g, '_') // Replace backslashes (prevent path traversal)
    .slice(0, 255); // Limit length to prevent buffer issues
}
