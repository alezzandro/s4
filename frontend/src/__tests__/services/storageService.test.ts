import { TransferItem, TransferRequest, storageService } from '@app/services/storageService';

// Mock apiClient instead of raw axios - storageService uses apiClient, not axios directly
jest.mock('@app/utils/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
  getAuthToken: jest.fn(() => null),
}));

// Import the mocked apiClient
import apiClient from '@app/utils/apiClient';
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the locations cache to ensure tests are isolated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (storageService as any).locationsCache = null;
  });

  describe('getLocations', () => {
    it('should fetch and normalize both S3 and local locations', async () => {
      const s3Buckets = {
        data: {
          buckets: [
            { Name: 'bucket1', Region: 'us-east-1', CreationDate: '2024-01-01' },
            { Name: 'bucket2', Region: 'us-west-2', CreationDate: '2024-01-02' },
          ],
        },
      };

      const localLocations = {
        data: {
          locations: [
            { id: 'local-0', name: 'Data Storage', type: 'local', available: true, path: '/mnt/data' },
            { id: 'local-1', name: 'Model Storage', type: 'local', available: false, path: '/mnt/models' },
          ],
        },
      };

      mockedApiClient.get.mockResolvedValueOnce(s3Buckets).mockResolvedValueOnce(localLocations);

      const { locations } = await storageService.getLocations();

      expect(mockedApiClient.get).toHaveBeenCalledTimes(2);
      expect(mockedApiClient.get).toHaveBeenCalledWith(`/buckets`);
      expect(mockedApiClient.get).toHaveBeenCalledWith(`/local/locations`);

      expect(locations).toHaveLength(4);

      // Check S3 locations
      expect(locations[0]).toEqual({
        id: 'bucket1',
        name: 'bucket1',
        type: 's3',
        available: true,
        region: 'us-east-1',
      });

      expect(locations[1]).toEqual({
        id: 'bucket2',
        name: 'bucket2',
        type: 's3',
        available: true,
        region: 'us-west-2',
      });

      // Check local locations
      expect(locations[2]).toEqual({
        id: 'local-0',
        name: 'Data Storage',
        type: 'local',
        available: true,
        path: '/mnt/data',
      });

      expect(locations[3]).toEqual({
        id: 'local-1',
        name: 'Model Storage',
        type: 'local',
        available: false,
        path: '/mnt/models',
      });
    });

    it('should return only S3 locations if local storage fails', async () => {
      const s3Buckets = {
        data: {
          buckets: [{ Name: 'bucket1', Region: 'us-east-1', CreationDate: '2024-01-01' }],
        },
      };

      mockedApiClient.get
        .mockResolvedValueOnce(s3Buckets)
        .mockRejectedValueOnce(new Error('Local storage unavailable'));

      const { locations } = await storageService.getLocations();

      expect(locations).toHaveLength(1);
      expect(locations[0]).toEqual({
        id: 'bucket1',
        name: 'bucket1',
        type: 's3',
        available: true,
        region: 'us-east-1',
      });
    });

    it('should return only local locations if S3 fails', async () => {
      const localLocations = {
        data: {
          locations: [{ id: 'local-0', name: 'Data Storage', type: 'local', available: true, path: '/mnt/data' }],
        },
      };

      mockedApiClient.get
        .mockRejectedValueOnce(new Error('S3 connection failed'))
        .mockResolvedValueOnce(localLocations);

      const { locations } = await storageService.getLocations();

      expect(locations).toHaveLength(1);
      expect(locations[0]).toEqual({
        id: 'local-0',
        name: 'Data Storage',
        type: 'local',
        available: true,
        path: '/mnt/data',
      });
    });

    it('should return empty array if both S3 and local storage fail', async () => {
      mockedApiClient.get
        .mockRejectedValueOnce(new Error('S3 connection failed'))
        .mockRejectedValueOnce(new Error('Local storage unavailable'));

      const { locations } = await storageService.getLocations();

      expect(locations).toHaveLength(0);
    });

    it('should log warnings when storage sources fail', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockedApiClient.get.mockRejectedValueOnce(new Error('S3 error')).mockRejectedValueOnce(new Error('Local error'));

      await storageService.getLocations();

      expect(consoleWarnSpy).toHaveBeenCalledWith('S3 storage unavailable:', expect.anything());
      expect(consoleWarnSpy).toHaveBeenCalledWith('Local storage unavailable:', expect.anything());
      expect(consoleErrorSpy).toHaveBeenCalledWith('All storage sources failed to load');

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('listFiles', () => {
    beforeEach(() => {
      // Mock getLocation for all listFiles tests
      const s3Locations = {
        data: {
          buckets: [{ Name: 'bucket1', Region: 'us-east-1' }],
        },
      };

      const localLocations = {
        data: {
          locations: [{ id: 'local-0', name: 'Data Storage', type: 'local', available: true }],
        },
      };

      mockedApiClient.get.mockResolvedValueOnce(s3Locations).mockResolvedValueOnce(localLocations);
    });

    it('should list S3 files and normalize them', async () => {
      const s3Objects = {
        data: {
          objects: [
            { Key: 'file1.txt', Size: 1024, LastModified: '2024-01-01T00:00:00Z' },
            { Key: 'folder/', Size: 0, LastModified: '2024-01-02T00:00:00Z' },
          ],
          totalCount: 2,
        },
      };

      mockedApiClient.get.mockResolvedValueOnce(s3Objects);

      const result = await storageService.listFiles('bucket1', 'path/to/');

      // S3 uses base64-encoded path in URL
      const encodedPath = btoa('path/to/');
      expect(mockedApiClient.get).toHaveBeenCalledWith(`/objects/bucket1/${encodedPath}`, {
        params: { continuationToken: undefined, maxKeys: undefined, q: undefined, mode: undefined },
      });

      expect(result.files).toHaveLength(2);

      expect(result.files[0]).toEqual({
        name: 'file1.txt',
        path: 'file1.txt',
        type: 'file',
        size: 1024,
        modified: new Date('2024-01-01T00:00:00Z'),
      });

      expect(result.files[1]).toEqual({
        name: 'folder',
        path: 'folder/',
        type: 'directory',
        size: 0,
        modified: new Date('2024-01-02T00:00:00Z'),
      });
    });

    it('should list local files and normalize them with base64-encoded path', async () => {
      const localFiles = {
        data: {
          files: [
            {
              name: 'file1.txt',
              path: 'path/to/file1.txt',
              type: 'file',
              size: 2048,
              modified: '2024-01-01T00:00:00Z',
            },
            {
              name: 'link',
              path: 'path/to/link',
              type: 'symlink',
              target: '../target',
            },
          ],
          totalCount: 2,
        },
      };

      // beforeEach already mocked locations, just add the files response
      mockedApiClient.get.mockResolvedValueOnce(localFiles);

      const result = await storageService.listFiles('local-0', 'path/to/');

      // Local storage requires base64-encoded paths
      const encodedPath = btoa('path/to/');
      expect(mockedApiClient.get).toHaveBeenCalledWith(`/local/files/local-0/${encodedPath}`, {
        params: { limit: undefined, offset: undefined, q: undefined, mode: undefined },
      });

      expect(result.files).toHaveLength(2);
      expect(result.totalCount).toBe(2);

      expect(result.files[0]).toEqual({
        name: 'file1.txt',
        path: 'path/to/file1.txt',
        type: 'file',
        size: 2048,
        modified: new Date('2024-01-01T00:00:00Z'),
        target: undefined,
      });

      expect(result.files[1]).toEqual({
        name: 'link',
        path: 'path/to/link',
        type: 'symlink',
        size: undefined,
        modified: undefined,
        target: '../target',
      });
    });

    it('should throw error if location not found', async () => {
      await expect(storageService.listFiles('nonexistent', '')).rejects.toThrow('Location not found: nonexistent');
    });
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      const s3Locations = {
        data: {
          buckets: [{ Name: 'bucket1', Region: 'us-east-1' }],
        },
      };

      const localLocations = {
        data: {
          locations: [{ id: 'local-0', name: 'Data Storage', type: 'local', available: true }],
        },
      };

      mockedApiClient.get.mockResolvedValueOnce(s3Locations).mockResolvedValueOnce(localLocations);
    });

    it('should upload file to S3', async () => {
      mockedApiClient.post.mockResolvedValueOnce({ data: { uploaded: true } });

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await storageService.uploadFile('bucket1', 'path/to/test.txt', file);

      const encodedPath = btoa('path/to/test.txt');
      expect(mockedApiClient.post).toHaveBeenCalledWith(
        `/objects/upload/bucket1/${encodedPath}`,
        expect.any(FormData),
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
    });

    it('should upload file to local storage with base64-encoded path', async () => {
      mockedApiClient.post.mockResolvedValueOnce({ data: { uploaded: true } });

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await storageService.uploadFile('local-0', 'path/to/test.txt', file);

      // Local storage requires base64-encoded paths
      const encodedPath = btoa('path/to/test.txt');
      expect(mockedApiClient.post).toHaveBeenCalledWith(`/local/files/local-0/${encodedPath}`, expect.any(FormData), {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    });
  });

  describe('deleteFile', () => {
    beforeEach(() => {
      const s3Locations = {
        data: {
          buckets: [{ Name: 'bucket1', Region: 'us-east-1' }],
        },
      };

      const localLocations = {
        data: {
          locations: [{ id: 'local-0', name: 'Data Storage', type: 'local', available: true }],
        },
      };

      mockedApiClient.get.mockResolvedValueOnce(s3Locations).mockResolvedValueOnce(localLocations);
    });

    it('should delete S3 file', async () => {
      mockedApiClient.delete.mockResolvedValueOnce({ data: { deleted: true } });

      await storageService.deleteFile('bucket1', 'path/to/file.txt');

      const encodedPath = btoa('path/to/file.txt');
      expect(mockedApiClient.delete).toHaveBeenCalledWith(`/objects/bucket1/${encodedPath}`);
    });

    it('should delete local file with base64-encoded path', async () => {
      mockedApiClient.delete.mockResolvedValueOnce({ data: { deleted: true } });

      await storageService.deleteFile('local-0', 'path/to/file.txt');

      // Local storage requires base64-encoded paths
      const encodedPath = btoa('path/to/file.txt');
      expect(mockedApiClient.delete).toHaveBeenCalledWith(`/local/files/local-0/${encodedPath}`);
    });
  });

  describe('createDirectory', () => {
    beforeEach(() => {
      const s3Locations = {
        data: {
          buckets: [{ Name: 'bucket1', Region: 'us-east-1' }],
        },
      };

      const localLocations = {
        data: {
          locations: [{ id: 'local-0', name: 'Data Storage', type: 'local', available: true }],
        },
      };

      mockedApiClient.get.mockResolvedValueOnce(s3Locations).mockResolvedValueOnce(localLocations);
    });

    it('should create S3 directory marker', async () => {
      mockedApiClient.post.mockResolvedValueOnce({ data: { created: true } });

      await storageService.createDirectory('bucket1', 'path/to/folder');

      // S3 directories are created by uploading a .s3keep marker file
      const encodedPath = btoa('path/to/folder/.s3keep');
      expect(mockedApiClient.post).toHaveBeenCalledWith(
        `/objects/upload/bucket1/${encodedPath}`,
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
      );
    });

    it('should create local directory with base64-encoded path', async () => {
      mockedApiClient.post.mockResolvedValueOnce({ data: { created: true } });

      await storageService.createDirectory('local-0', 'path/to/folder');

      // Local storage requires base64-encoded paths
      const encodedPath = btoa('path/to/folder');
      expect(mockedApiClient.post).toHaveBeenCalledWith(`/local/directories/local-0/${encodedPath}`);
    });
  });

  describe('checkConflicts', () => {
    beforeEach(() => {
      // Mock getLocation for checkConflicts tests
      const s3Locations = {
        data: {
          buckets: [{ Name: 'src', Region: 'us-east-1' }],
        },
      };

      const localLocations = {
        data: {
          locations: [{ id: 'local-0', name: 'Data Storage', type: 'local', available: true }],
        },
      };

      mockedApiClient.get.mockResolvedValueOnce(s3Locations).mockResolvedValueOnce(localLocations);
    });

    it('should check for file conflicts', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: {
          conflicts: ['file1.txt', 'file2.txt'],
          nonConflicting: ['file3.txt'],
        },
      });

      const items: TransferItem[] = [
        { path: 'file1.txt', type: 'file' },
        { path: 'file2.txt', type: 'file' },
        { path: 'file3.txt', type: 'file' },
      ];

      const response = await storageService.checkConflicts('src', 'source/', items, 'local-0', 'dest/');

      expect(mockedApiClient.post).toHaveBeenCalledWith(`/transfer/check-conflicts`, {
        source: { type: 's3', locationId: 'src', path: 'source/' },
        destination: { type: 'local', locationId: 'local-0', path: 'dest/' },
        items,
      });

      expect(response.conflicts).toEqual(['file1.txt', 'file2.txt']);
      expect(response.nonConflicting).toEqual(['file3.txt']);
    });
  });

  describe('initiateTransfer', () => {
    it('should initiate cross-storage transfer', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: {
          jobId: 'job-123',
          sseUrl: '/api/transfer/progress/job-123',
        },
      });

      const request: TransferRequest = {
        source: { type: 's3' as const, locationId: 'bucket1', path: 'source/' },
        destination: { type: 'local' as const, locationId: 'local-0', path: 'dest/' },
        items: [
          { path: 'file1.txt', type: 'file' },
          { path: 'file2.txt', type: 'file' },
        ],
        conflictResolution: 'rename' as const,
      };

      const response = await storageService.initiateTransfer(request);

      expect(mockedApiClient.post).toHaveBeenCalledWith(`/transfer`, request);

      expect(response).toEqual({
        jobId: 'job-123',
        sseUrl: '/api/transfer/progress/job-123',
      });
    });
  });

  describe('cancelTransfer', () => {
    it('should cancel transfer job', async () => {
      mockedApiClient.delete.mockResolvedValueOnce({ data: { cancelled: true } });

      await storageService.cancelTransfer('job-123');

      expect(mockedApiClient.delete).toHaveBeenCalledWith(`/transfer/job-123`);
    });
  });
});
