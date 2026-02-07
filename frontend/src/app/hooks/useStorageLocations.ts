import { useCallback, useEffect, useState } from 'react';
import { StorageLocation, storageService } from '@app/services/storageService';
import { notifyError, notifyWarning } from '@app/utils/notifications';

/**
 * Options for useStorageLocations hook
 */
export interface UseStorageLocationsOptions {
  /**
   * When true, suppresses automatic notifications for storage status.
   * Use this when the caller handles notifications and UX themselves
   * (e.g., StorageRouteGuard which redirects and shows its own notification).
   */
  suppressNotifications?: boolean;
}

/**
 * Return type for useStorageLocations hook
 */
export interface UseStorageLocationsReturn {
  /** List of storage locations (S3 buckets and PVC mounts) */
  locations: StorageLocation[];
  /** Whether locations are currently being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Manually refresh storage locations from backend */
  refreshLocations: () => Promise<void>;
}

/**
 * Custom hook to load and manage storage locations
 *
 * This hook consolidates the pattern of loading storage locations
 * from the backend, handling loading states, and emitting notifications
 * for warnings/errors.
 *
 * @returns Object with locations, loading state, error, and refresh function
 *
 * @example
 * ```tsx
 * const { locations, loading, error, refreshLocations } = useStorageLocations();
 *
 * if (loading) return <Spinner />;
 * if (error) return <Alert variant="danger">{error}</Alert>;
 *
 * return (
 *   <div>
 *     <Button onClick={refreshLocations}>Refresh</Button>
 *     {locations.map(loc => <div key={loc.id}>{loc.name}</div>)}
 *   </div>
 * );
 * ```
 */
export const useStorageLocations = (options: UseStorageLocationsOptions = {}): UseStorageLocationsReturn => {
  const { suppressNotifications = false } = options;
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get locations with status information
      const result = await storageService.getLocations();
      const { locations: locs, s3Status, localStatus } = result;
      setLocations(locs);

      // Only fire notifications if not suppressed
      if (!suppressNotifications) {
        // Determine appropriate warning message based on status
        const availableCount = locs.filter((l) => l.available).length;

        if (locs.length === 0) {
          // No storage locations at all
          if (!s3Status.success && !localStatus.success) {
            // Both failed
            notifyWarning(
              'No storage configured',
              'Configure S3 connection settings and/or LOCAL_STORAGE_PATHS to enable storage operations',
            );
          } else if (!s3Status.success) {
            // S3 failed, local might be empty
            notifyWarning('S3 connection failed', 'Please configure S3 settings to enable storage operations');
          } else if (s3Status.success) {
            // S3 succeeded but returned no buckets
            notifyWarning('No buckets available', 'Please create an S3 bucket first to enable storage operations');
          }
        } else if (availableCount === 0) {
          // Have locations but all unavailable
          notifyWarning(
            'All storage locations unavailable',
            'Please check your S3 connection settings and local storage paths',
          );
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load storage locations';
      setError(errorMsg);
      if (!suppressNotifications) {
        notifyError('Error loading storage locations', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [suppressNotifications]);

  const refreshLocations = useCallback(async () => {
    await storageService.refreshLocations();
    await loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  return { locations, loading, error, refreshLocations };
};
