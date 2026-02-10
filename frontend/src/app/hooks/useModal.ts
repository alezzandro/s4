import { useCallback, useState } from 'react';

/**
 * Return type for useModal hook
 */
export interface UseModalReturn {
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
  /** Toggle the modal open/closed state */
  toggle: () => void;
}

/**
 * Custom hook to manage modal open/close state
 *
 * This hook consolidates the common pattern of managing modal visibility
 * across the application, replacing 12+ duplicate implementations.
 *
 * @param initialState - Initial open state (default: false)
 * @returns Object with isOpen state and open/close/toggle functions
 *
 * @example
 * ```tsx
 * const deleteModal = useModal();
 *
 * return (
 *   <>
 *     <Button onClick={deleteModal.open}>Delete</Button>
 *     <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.close}>
 *       {/* Modal content *\/}
 *     </Modal>
 *   </>
 * );
 * ```
 */
export const useModal = (initialState = false): UseModalReturn => {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return { isOpen, open, close, toggle };
};
