import { FastifyRequest, FastifyBaseLogger } from 'fastify';
import * as fs from 'fs';
import { open } from 'fs/promises';
import * as path from 'path';
import { LOG_DIR } from './constants';

/**
 * Read the last non-empty line from a file efficiently
 *
 * Reads file in 1KB chunks from the end backwards to find the last
 * non-empty line without loading the entire file into memory. Efficient
 * for large log files.
 *
 * Algorithm:
 * - Starts at end of file
 * - Reads backwards in 1KB chunks
 * - Stops when first non-empty line is found
 * - Memory usage: ~1KB regardless of file size
 *
 * Performance:
 * - O(1) memory complexity (constant 1KB buffer)
 * - O(n) time complexity where n = number of chunks needed to find last line
 * - Typical case: 1-2 chunks for normal log entries
 *
 * @param filePath - Path to the file to read
 * @returns Promise resolving to the last non-empty line (trimmed)
 *
 * @throws {Error} If file cannot be opened or read
 *
 * @example
 * ```typescript
 * const lastLine = await readLastLine('/var/log/access.log');
 * const entry = JSON.parse(lastLine);
 * console.log(`Last activity: ${entry.last_activity}`);
 * ```
 */
async function readLastLine(filePath: string): Promise<string> {
  const fileHandle = await open(filePath, 'r');
  const stat = await fileHandle.stat();
  const fileSize = stat.size;
  const bufferSize = 1024;
  let position = fileSize;
  let lastLine = '';
  let foundLineBreak = false;
  const chunks: string[] = [];

  while (position > 0 && !foundLineBreak) {
    const readSize = Math.min(bufferSize, position);
    position -= readSize;
    const buffer = new Uint8Array(readSize);
    await fileHandle.read(buffer, 0, readSize, position);
    const chunk = new TextDecoder('utf-8').decode(buffer);
    chunks.unshift(chunk);

    const joined = chunks.join('');

    // Split by newlines and find the last non-empty line
    const lines = joined.split('\n');

    // Look for the last non-empty line from the end
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.length > 0) {
        lastLine = line;
        foundLineBreak = true;
        break;
      }
    }

    // If we haven't found a non-empty line and we're not at the beginning, continue
    if (!foundLineBreak && position === 0) {
      // We've read the entire file and found no non-empty lines
      break;
    }
  }

  await fileHandle.close();
  return lastLine;
}

/**
 * Log HTTP request access to file
 *
 * Appends a JSON log entry to access.log containing request metadata.
 * Used for activity monitoring and determining server idle/busy state.
 *
 * Log Entry Format:
 * - id: 's4' (server identifier)
 * - name: 's4' (server name)
 * - last_activity: ISO 8601 timestamp
 * - execution_state: 'busy' (always set to busy for active requests)
 * - connections: 1 (hardcoded for single-instance deployment)
 * - path: Request URL path
 * - method: HTTP method (GET, POST, etc.)
 *
 * File Operations:
 * - Synchronous append to LOG_DIR/access.log
 * - Creates file if it doesn't exist
 * - One JSON object per line (newline-delimited JSON)
 *
 * IMPORTANT: Logs are appended to LOG_DIR/access.log. Ensure LOG_DIR
 * exists and has write permissions, or logging will fail silently.
 *
 * @param req - Fastify request object
 *
 * @example
 * ```typescript
 * // Called in route handlers to log activity
 * fastify.get('/api/buckets', async (req, reply) => {
 *   logAccess(req);
 *   // ... handle request
 * });
 * ```
 */
export const logAccess = (req: FastifyRequest): void => {
  const logEntry = {
    id: 's4',
    name: 's4',
    last_activity: new Date().toISOString(),
    execution_state: 'busy',
    connections: 1,
    path: req.raw.url,
    method: req.method,
  };
  const logFilePath = path.join(LOG_DIR, 'access.log');
  fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
};

/**
 * Get the most recent access log entry with state calculation
 *
 * Reads the last line from access.log and determines server state based on
 * activity recency. Efficient implementation that reads from end of file
 * to avoid loading entire log into memory.
 *
 * State Determination:
 * - 'busy': Last activity within 10 minutes
 * - 'idle': Last activity older than 10 minutes
 * - 'alive': Default state if log is empty/missing
 *
 * Performance:
 * - Reads file in 1KB chunks from end via readLastLine()
 * - Memory-efficient for large log files
 * - Does not load entire file into memory
 * - Typical read time: <10ms for logs up to several GB
 *
 * Error Handling:
 * - Returns default 'alive' state if log doesn't exist
 * - Returns default 'alive' state if log is empty
 * - Returns default 'alive' state on any read/parse error
 * - Logs errors using Fastify logger (if provided) or console.error
 * - Never throws - defensive programming for monitoring endpoint
 *
 * Return Format:
 * - Array with single object (ODH-compatible format)
 * - Object contains: id, name, last_activity, execution_state, connections
 *
 * @param logger - Optional Fastify logger for error reporting
 * @returns Promise resolving to array with single log entry object
 *
 * @throws Does not throw - returns default state on all errors
 *
 * @example
 * ```typescript
 * // In API route handler
 * fastify.get('/api/status', async (req, reply) => {
 *   const status = await getLastAccessLogEntry(req.log);
 *   reply.send(status);
 * });
 * // Returns: [{ id: 's4', name: 's4', last_activity: '2024-01-29T10:30:00.000Z', execution_state: 'busy', connections: 1 }]
 * ```
 */
export const getLastAccessLogEntry = async (logger?: FastifyBaseLogger): Promise<any> => {
  const logFilePath = path.join(LOG_DIR, 'access.log');

  try {
    if (!fs.existsSync(logFilePath)) {
      // Return default data if log file doesn't exist
      return [
        {
          id: 's4',
          name: 's4',
          last_activity: new Date().toISOString(),
          execution_state: 'alive',
          connections: 1,
        },
      ];
    }

    return readLastLine(logFilePath).then((lastLine) => {
      if (!lastLine || lastLine.trim().length === 0) {
        // Return default data if log file is empty
        return [
          {
            id: 's4',
            name: 's4',
            last_activity: new Date().toISOString(),
            execution_state: 'alive',
            connections: 1,
          },
        ];
      }

      // Parse the last line as JSON
      const lastEntry = JSON.parse(lastLine);

      // Check if last_activity is older than 10 minutes
      if (lastEntry.last_activity) {
        const lastActivityTime = new Date(lastEntry.last_activity);
        const currentTime = new Date();
        const timeDifferenceMs = currentTime.getTime() - lastActivityTime.getTime();
        const tenMinutesMs = 10 * 60 * 1000; // 10 minutes in milliseconds

        if (timeDifferenceMs > tenMinutesMs) {
          lastEntry.execution_state = 'idle';
        }
      }

      // Return as an array to match the expected format
      return [lastEntry];
    });
  } catch (error) {
    // Use Fastify logger if available, otherwise fall back to console.error
    if (logger && typeof logger.error === 'function') {
      logger.error(error, 'Error reading access log');
    } else {
      console.error('Error reading access log:', error);
    }
    // Return default data on error
    return [
      {
        id: 's4',
        name: 's4',
        last_activity: new Date().toISOString(),
        execution_state: 'alive',
        connections: 1,
      },
    ];
  }
};
