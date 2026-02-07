import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransferProgress } from '@app/components/Transfer/TransferProgress';
import { storageService } from '@app/services/storageService';
import { MockEventSource } from '../../../utils/testHelpers';

// Mock the storage service
jest.mock('@app/services/storageService', () => ({
  storageService: {
    cancelTransfer: jest.fn(),
  },
}));

// Mock the emitter
jest.mock('@app/utils/emitter', () => ({
  __esModule: true,
  default: {
    emit: jest.fn(),
  },
}));

// Create a shared mock EventSource for the tests
let mockEventSource: MockEventSource;

// Mock the SSE tickets module
jest.mock('@app/utils/sseTickets', () => ({
  createAuthenticatedEventSource: jest.fn(() => {
    mockEventSource = new MockEventSource('http://test.com/events');
    return Promise.resolve(mockEventSource);
  }),
}));

// Import the mocked function
import { createAuthenticatedEventSource } from '@app/utils/sseTickets';
const mockCreateAuthenticatedEventSource = createAuthenticatedEventSource as jest.MockedFunction<
  typeof createAuthenticatedEventSource
>;

describe('TransferProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (mockEventSource) {
      mockEventSource.close();
    }
  });

  it('should establish SSE connection when opened with jobId and sseUrl', async () => {
    render(
      <TransferProgress isOpen={true} jobId="job-123" sseUrl="http://test.com/progress/job-123" onClose={jest.fn()} />,
    );

    await waitFor(() => {
      expect(mockCreateAuthenticatedEventSource).toHaveBeenCalledWith('job-123', 'transfer');
    });
  });

  it('should display transfer progress updates', async () => {
    render(
      <TransferProgress isOpen={true} jobId="job-123" sseUrl="http://test.com/progress/job-123" onClose={jest.fn()} />,
    );

    // Wait for SSE connection to be established
    await waitFor(() => {
      expect(mockCreateAuthenticatedEventSource).toHaveBeenCalled();
    });

    // Simulate receiving a job progress update (new format with files array)
    mockEventSource.simulateMessage({
      jobId: 'job-123',
      status: 'active',
      progress: { totalFiles: 1, completedFiles: 0, failedFiles: 0, percentage: 50 },
      files: [{ file: 'test-file.txt', status: 'transferring', loaded: 512, total: 1024 }],
    });

    await waitFor(() => {
      expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      expect(screen.getByText('Transferring')).toBeInTheDocument();
    });
  });

  it('should show completed status for finished transfers', async () => {
    render(
      <TransferProgress isOpen={true} jobId="job-123" sseUrl="http://test.com/progress/job-123" onClose={jest.fn()} />,
    );

    await waitFor(() => {
      expect(mockCreateAuthenticatedEventSource).toHaveBeenCalled();
    });

    mockEventSource.simulateMessage({
      jobId: 'job-123',
      status: 'active',
      progress: { totalFiles: 1, completedFiles: 1, failedFiles: 0, percentage: 100 },
      files: [{ file: 'test-file.txt', status: 'completed', loaded: 1024, total: 1024 }],
    });

    await waitFor(() => {
      expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });
  });

  it('should show error status for failed transfers', async () => {
    render(
      <TransferProgress isOpen={true} jobId="job-123" sseUrl="http://test.com/progress/job-123" onClose={jest.fn()} />,
    );

    await waitFor(() => {
      expect(mockCreateAuthenticatedEventSource).toHaveBeenCalled();
    });

    mockEventSource.simulateMessage({
      jobId: 'job-123',
      status: 'active',
      progress: { totalFiles: 1, completedFiles: 0, failedFiles: 1, percentage: 0 },
      files: [{ file: 'test-file.txt', status: 'error', loaded: 0, total: 1024, error: 'Network error' }],
    });

    await waitFor(() => {
      expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should display progress bar for transferring files', async () => {
    render(
      <TransferProgress isOpen={true} jobId="job-123" sseUrl="http://test.com/progress/job-123" onClose={jest.fn()} />,
    );

    await waitFor(() => {
      expect(mockCreateAuthenticatedEventSource).toHaveBeenCalled();
    });

    mockEventSource.simulateMessage({
      jobId: 'job-123',
      status: 'active',
      progress: { totalFiles: 1, completedFiles: 0, failedFiles: 0, percentage: 50 },
      files: [{ file: 'test-file.txt', status: 'transferring', loaded: 512, total: 1024 }],
    });

    await waitFor(() => {
      // Progress text is in aria-hidden element, so we need to use getAllByText with hidden option
      const progressTexts = screen.getAllByText(/512 Bytes.*1 KB/i, { selector: '*' });
      expect(progressTexts.length).toBeGreaterThan(0);
    });
  });

  it('should handle multiple file transfers', async () => {
    render(
      <TransferProgress isOpen={true} jobId="job-123" sseUrl="http://test.com/progress/job-123" onClose={jest.fn()} />,
    );

    await waitFor(() => {
      expect(mockCreateAuthenticatedEventSource).toHaveBeenCalled();
    });

    mockEventSource.simulateMessage({
      jobId: 'job-123',
      status: 'active',
      progress: { totalFiles: 2, completedFiles: 1, failedFiles: 0, percentage: 50 },
      files: [
        { file: 'file1.txt', status: 'transferring', loaded: 512, total: 1024 },
        { file: 'file2.txt', status: 'completed', loaded: 2048, total: 2048 },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.txt')).toBeInTheDocument();
    });
  });

  it('should show confirmation dialog and call cancelTransfer when confirmed', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();

    render(
      <TransferProgress
        isOpen={true}
        jobId="job-123"
        sseUrl="http://test.com/progress/job-123"
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(mockCreateAuthenticatedEventSource).toHaveBeenCalled();
    });

    // First click opens confirmation dialog
    const cancelButton = screen.getByText('Cancel Transfer');
    await user.click(cancelButton);

    // Check confirmation dialog is shown
    await waitFor(() => {
      expect(screen.getByText('Cancel transfer?')).toBeInTheDocument();
      expect(
        screen.getByText('Are you sure you want to cancel this transfer? Files already transferred will remain.'),
      ).toBeInTheDocument();
    });

    // Confirm the cancellation
    const confirmButton = screen.getAllByText('Cancel Transfer')[1]; // The second one is in the dialog
    await user.click(confirmButton);

    await waitFor(() => {
      expect(storageService.cancelTransfer).toHaveBeenCalledWith('job-123');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should not cancel when Continue Transfer is clicked in confirmation dialog', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();

    render(
      <TransferProgress
        isOpen={true}
        jobId="job-123"
        sseUrl="http://test.com/progress/job-123"
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(mockCreateAuthenticatedEventSource).toHaveBeenCalled();
    });

    // First click opens confirmation dialog
    const cancelButton = screen.getByText('Cancel Transfer');
    await user.click(cancelButton);

    // Click Continue Transfer to dismiss dialog
    await waitFor(() => {
      expect(screen.getByText('Continue Transfer')).toBeInTheDocument();
    });

    const continueButton = screen.getByText('Continue Transfer');
    await user.click(continueButton);

    expect(storageService.cancelTransfer).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should show "No active transfers" when no transfers exist', () => {
    render(
      <TransferProgress isOpen={true} jobId="job-123" sseUrl="http://test.com/progress/job-123" onClose={jest.fn()} />,
    );

    expect(screen.getByText('No active transfers')).toBeInTheDocument();
  });

  it('should close SSE connection when component unmounts', async () => {
    const { unmount } = render(
      <TransferProgress isOpen={true} jobId="job-123" sseUrl="http://test.com/progress/job-123" onClose={jest.fn()} />,
    );

    await waitFor(() => {
      expect(mockCreateAuthenticatedEventSource).toHaveBeenCalled();
    });

    const closeSpy = jest.spyOn(mockEventSource, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('should not establish connection when jobId is null', () => {
    render(<TransferProgress isOpen={true} jobId={null} sseUrl={null} onClose={jest.fn()} />);

    expect(mockCreateAuthenticatedEventSource).not.toHaveBeenCalled();
  });

  it('should handle SSE error events', async () => {
    render(
      <TransferProgress isOpen={true} jobId="job-123" sseUrl="http://test.com/progress/job-123" onClose={jest.fn()} />,
    );

    await waitFor(() => {
      expect(mockCreateAuthenticatedEventSource).toHaveBeenCalled();
    });

    // Simulate SSE error
    mockEventSource.simulateError();

    // EventSource should be closed on error
    await waitFor(() => {
      expect(mockEventSource.readyState).toBe(mockEventSource.CLOSED);
    });
  });

  it('should update existing file transfer on new message', async () => {
    render(
      <TransferProgress isOpen={true} jobId="job-123" sseUrl="http://test.com/progress/job-123" onClose={jest.fn()} />,
    );

    await waitFor(() => {
      expect(mockCreateAuthenticatedEventSource).toHaveBeenCalled();
    });

    // First update
    mockEventSource.simulateMessage({
      jobId: 'job-123',
      status: 'active',
      progress: { totalFiles: 1, completedFiles: 0, failedFiles: 0, percentage: 50 },
      files: [{ file: 'test-file.txt', status: 'transferring', loaded: 512, total: 1024 }],
    });

    await waitFor(() => {
      // Progress text is in aria-hidden element
      const progressTexts = screen.getAllByText(/512 Bytes/i, { selector: '*' });
      expect(progressTexts.length).toBeGreaterThan(0);
    });

    // Second update for same file
    mockEventSource.simulateMessage({
      jobId: 'job-123',
      status: 'active',
      progress: { totalFiles: 1, completedFiles: 0, failedFiles: 0, percentage: 100 },
      files: [{ file: 'test-file.txt', status: 'transferring', loaded: 1024, total: 1024 }],
    });

    await waitFor(() => {
      // Progress text is in aria-hidden element
      const progressTexts = screen.getAllByText(/1 KB.*\/.*1 KB/i, { selector: '*' });
      expect(progressTexts.length).toBeGreaterThan(0);
    });
  });
});
