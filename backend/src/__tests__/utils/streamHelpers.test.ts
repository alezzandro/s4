import { Transform, PassThrough, Readable } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';
import { EventEmitter } from 'events';
import { createProgressTransform, uploadWithCleanup } from '../../utils/streamHelpers';

describe('Stream Helpers Utility', () => {
  describe('createProgressTransform', () => {
    it('should return a Transform stream', () => {
      const onProgress = jest.fn();
      const transform = createProgressTransform(onProgress);

      expect(transform).toBeInstanceOf(Transform);
    });

    it('should pass data through unchanged', async () => {
      const onProgress = jest.fn();
      const transform = createProgressTransform(onProgress);

      const input = Buffer.from('Hello, World!');
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        transform.on('data', (chunk) => chunks.push(chunk));
        transform.on('end', resolve);
        transform.on('error', reject);

        transform.write(input);
        transform.end();
      });

      const output = Buffer.concat(chunks);
      expect(output.toString()).toBe('Hello, World!');
    });

    it('should call onProgress when threshold is reached', async () => {
      const onProgress = jest.fn();
      const thresholdBytes = 10;
      const transform = createProgressTransform(onProgress, thresholdBytes);

      await new Promise<void>((resolve, reject) => {
        transform.on('finish', resolve);
        transform.on('error', reject);

        // Write 15 bytes (exceeds threshold of 10)
        transform.write(Buffer.alloc(15));
        transform.end();
      });

      // Should have been called at least once during the write (when threshold reached)
      // and once more in flush
      expect(onProgress).toHaveBeenCalled();
    });

    it('should not call onProgress until threshold is reached', async () => {
      const onProgress = jest.fn();
      const thresholdBytes = 100;
      const transform = createProgressTransform(onProgress, thresholdBytes);

      // Write less than threshold
      transform.write(Buffer.alloc(50));

      // Should not have been called yet (below threshold)
      expect(onProgress).not.toHaveBeenCalled();

      // Cleanup
      transform.end();
      await new Promise((resolve) => transform.on('finish', resolve));
    });

    it('should report final progress in flush', async () => {
      const onProgress = jest.fn();
      const thresholdBytes = 1000; // High threshold
      const transform = createProgressTransform(onProgress, thresholdBytes);

      await new Promise<void>((resolve, reject) => {
        transform.on('finish', resolve);
        transform.on('error', reject);

        // Write less than threshold
        transform.write(Buffer.alloc(500));
        transform.end();
      });

      // Should report final progress in flush
      expect(onProgress).toHaveBeenCalledWith(500);
    });

    it('should accumulate bytes across multiple writes', async () => {
      const onProgress = jest.fn();
      const thresholdBytes = 100;
      const transform = createProgressTransform(onProgress, thresholdBytes);

      await new Promise<void>((resolve, reject) => {
        transform.on('finish', resolve);
        transform.on('error', reject);

        // Write multiple chunks
        transform.write(Buffer.alloc(30));
        transform.write(Buffer.alloc(40));
        transform.write(Buffer.alloc(50)); // Total: 120, crosses threshold
        transform.end();
      });

      // Should have reported progress at 120 bytes (first threshold cross)
      expect(onProgress).toHaveBeenCalledWith(120);
    });

    it('should report multiple progress updates for large streams', async () => {
      const onProgress = jest.fn();
      const thresholdBytes = 100;
      const transform = createProgressTransform(onProgress, thresholdBytes);

      await new Promise<void>((resolve, reject) => {
        transform.on('finish', resolve);
        transform.on('error', reject);

        // Write 350 bytes - will trigger when threshold is crossed
        // Since all data is written at once, it crosses threshold once + flush
        transform.write(Buffer.alloc(350));
        transform.end();
      });

      // Progress reported when threshold crossed and in flush
      expect(onProgress).toHaveBeenCalled();
      // Final call should report total bytes
      expect(onProgress).toHaveBeenLastCalledWith(350);
    });

    it('should use default 1MB threshold when not specified', () => {
      const onProgress = jest.fn();
      const transform = createProgressTransform(onProgress);

      // Write less than 1MB
      transform.write(Buffer.alloc(500 * 1024)); // 500KB

      // Should not have been called (below 1MB threshold)
      expect(onProgress).not.toHaveBeenCalled();

      transform.end();
    });

    it('should handle empty stream', async () => {
      const onProgress = jest.fn();
      const transform = createProgressTransform(onProgress, 100);

      await new Promise<void>((resolve, reject) => {
        transform.on('finish', resolve);
        transform.on('error', reject);

        // End without writing any data
        transform.end();
      });

      // Should not call onProgress for empty stream
      expect(onProgress).not.toHaveBeenCalled();
    });

    it('should report correct loaded bytes', async () => {
      const onProgress = jest.fn();
      const transform = createProgressTransform(onProgress, 50);
      const progressValues: number[] = [];

      onProgress.mockImplementation((loaded: number) => {
        progressValues.push(loaded);
      });

      await new Promise<void>((resolve, reject) => {
        transform.on('finish', resolve);
        transform.on('error', reject);

        transform.write(Buffer.alloc(25));
        transform.write(Buffer.alloc(30)); // 55 total - crosses 50 threshold
        transform.write(Buffer.alloc(60)); // 115 total - crosses 100 threshold
        transform.end();
      });

      expect(progressValues).toContain(55);
      expect(progressValues).toContain(115);
    });

    it('should work in a pipeline', async () => {
      const onProgress = jest.fn();
      const transform = createProgressTransform(onProgress, 10);

      const source = new PassThrough();
      const sink = new PassThrough();
      const chunks: Buffer[] = [];

      sink.on('data', (chunk) => chunks.push(chunk));

      source.pipe(transform).pipe(sink);

      await new Promise<void>((resolve, reject) => {
        sink.on('finish', resolve);
        sink.on('error', reject);

        source.write(Buffer.from('Hello'));
        source.write(Buffer.from('World'));
        source.end();
      });

      const output = Buffer.concat(chunks).toString();
      expect(output).toBe('HelloWorld');
      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('uploadWithCleanup', () => {
    // Create a mock Upload class
    class MockUpload extends EventEmitter {
      done = jest.fn().mockResolvedValue(undefined);
      removeAllListeners = jest.fn().mockReturnThis();
    }

    it('should call upload.done()', async () => {
      const mockUpload = new MockUpload();

      await uploadWithCleanup(mockUpload as unknown as Upload);

      expect(mockUpload.done).toHaveBeenCalled();
    });

    it('should register httpUploadProgress listener when onProgress provided', async () => {
      const mockUpload = new MockUpload();
      const onProgress = jest.fn();

      // Spy on the 'on' method
      const onSpy = jest.spyOn(mockUpload, 'on');

      await uploadWithCleanup(mockUpload as unknown as Upload, onProgress);

      expect(onSpy).toHaveBeenCalledWith('httpUploadProgress', expect.any(Function));
    });

    it('should not register listener when onProgress not provided', async () => {
      const mockUpload = new MockUpload();
      const onSpy = jest.spyOn(mockUpload, 'on');

      await uploadWithCleanup(mockUpload as unknown as Upload);

      expect(onSpy).not.toHaveBeenCalled();
    });

    it('should remove listeners after successful upload', async () => {
      const mockUpload = new MockUpload();
      const onProgress = jest.fn();

      await uploadWithCleanup(mockUpload as unknown as Upload, onProgress);

      expect(mockUpload.removeAllListeners).toHaveBeenCalledWith('httpUploadProgress');
    });

    it('should remove listeners even when upload fails', async () => {
      const mockUpload = new MockUpload();
      mockUpload.done.mockRejectedValue(new Error('Upload failed'));
      const onProgress = jest.fn();

      await expect(uploadWithCleanup(mockUpload as unknown as Upload, onProgress)).rejects.toThrow('Upload failed');

      expect(mockUpload.removeAllListeners).toHaveBeenCalledWith('httpUploadProgress');
    });

    it('should call onProgress with loaded bytes', async () => {
      const mockUpload = new MockUpload();
      const onProgress = jest.fn();

      // Simulate progress events
      mockUpload.done.mockImplementation(async () => {
        mockUpload.emit('httpUploadProgress', { loaded: 100 });
        mockUpload.emit('httpUploadProgress', { loaded: 200 });
        mockUpload.emit('httpUploadProgress', { loaded: 300 });
      });

      await uploadWithCleanup(mockUpload as unknown as Upload, onProgress);

      expect(onProgress).toHaveBeenCalledWith(100);
      expect(onProgress).toHaveBeenCalledWith(200);
      expect(onProgress).toHaveBeenCalledWith(300);
    });

    it('should handle missing loaded property in progress event', async () => {
      const mockUpload = new MockUpload();
      const onProgress = jest.fn();

      mockUpload.done.mockImplementation(async () => {
        mockUpload.emit('httpUploadProgress', {}); // No loaded property
      });

      await uploadWithCleanup(mockUpload as unknown as Upload, onProgress);

      expect(onProgress).toHaveBeenCalledWith(0);
    });

    it('should not remove listeners when no onProgress provided', async () => {
      const mockUpload = new MockUpload();

      await uploadWithCleanup(mockUpload as unknown as Upload);

      expect(mockUpload.removeAllListeners).not.toHaveBeenCalled();
    });

    it('should propagate upload errors', async () => {
      const mockUpload = new MockUpload();
      const error = new Error('Network error');
      mockUpload.done.mockRejectedValue(error);

      await expect(uploadWithCleanup(mockUpload as unknown as Upload)).rejects.toThrow('Network error');
    });

    it('should resolve when upload succeeds', async () => {
      const mockUpload = new MockUpload();
      mockUpload.done.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });

      await expect(uploadWithCleanup(mockUpload as unknown as Upload)).resolves.toBeUndefined();
    });
  });
});
