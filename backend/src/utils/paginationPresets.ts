/**
 * Pagination preset values — duplicated from frontend because no shared package exists.
 * Keep in sync with frontend/src/app/utils/paginationPresets.ts.
 */

export const PAGE_SIZE_PRESETS = [10, 25, 50, 100, 250, 500, 1000] as const;

export const DEFAULT_PAGE_SIZE = 100;

/** Snaps an arbitrary number to the nearest preset value. */
export function snapToNearestPreset(value: number): number {
  let closest: number = PAGE_SIZE_PRESETS[0];
  let minDiff = Math.abs(value - closest);
  for (const preset of PAGE_SIZE_PRESETS) {
    const diff = Math.abs(value - preset);
    if (diff < minDiff) {
      minDiff = diff;
      closest = preset;
    }
  }
  return closest;
}
