import Emitter from './emitter';
import { AxiosError } from 'axios';

/**
 * Emit a success notification
 *
 * @param title - Notification title
 * @param description - Notification description/message
 *
 * @example
 * ```ts
 * notifySuccess('Bucket created', `Bucket ${name} created successfully`);
 * ```
 */
export const notifySuccess = (title: string, description: string): void => {
  Emitter.emit('notification', {
    variant: 'success',
    title,
    description,
  });
};

/**
 * Emit an error notification
 *
 * @param title - Notification title
 * @param description - Notification description/message
 *
 * @example
 * ```ts
 * notifyError('Upload failed', 'The file could not be uploaded');
 * ```
 */
export const notifyError = (title: string, description: string): void => {
  Emitter.emit('notification', {
    variant: 'danger',
    title,
    description,
  });
};

/**
 * Emit a warning notification
 *
 * @param title - Notification title
 * @param description - Notification description/message
 *
 * @example
 * ```ts
 * notifyWarning('Invalid name', 'Bucket name must be between 3 and 63 characters');
 * ```
 */
export const notifyWarning = (title: string, description: string): void => {
  Emitter.emit('notification', {
    variant: 'warning',
    title,
    description,
  });
};

/**
 * Emit an info notification
 *
 * @param title - Notification title
 * @param description - Notification description/message
 *
 * @example
 * ```ts
 * notifyInfo('Storage refreshed', 'Locations have been updated');
 * ```
 */
export const notifyInfo = (title: string, description: string): void => {
  Emitter.emit('notification', {
    variant: 'info',
    title,
    description,
  });
};

/**
 * Emit an error notification from an API error
 *
 * This helper extracts error details from Axios errors and displays
 * them in a user-friendly format. It also logs the error to the console
 * for debugging.
 *
 * @param operation - Name of the operation that failed (e.g., "Upload file", "Delete bucket")
 * @param error - The error object (typically from axios catch)
 *
 * @example
 * ```ts
 * try {
 *   await apiClient.delete(`/buckets/${name}`);
 * } catch (error) {
 *   notifyApiError('Delete bucket', error);
 * }
 * ```
 */
export const notifyApiError = (operation: string, error: unknown): void => {
  console.error(`${operation} failed:`, error);

  if (error instanceof AxiosError) {
    const title = error.response?.data?.error || `${operation} Failed`;
    const description = error.response?.data?.message || error.message || 'An error occurred';

    Emitter.emit('notification', {
      variant: 'danger',
      title,
      description,
    });
  } else if (error instanceof Error) {
    Emitter.emit('notification', {
      variant: 'danger',
      title: `${operation} Failed`,
      description: error.message,
    });
  } else {
    Emitter.emit('notification', {
      variant: 'danger',
      title: `${operation} Failed`,
      description: 'An unexpected error occurred',
    });
  }
};
