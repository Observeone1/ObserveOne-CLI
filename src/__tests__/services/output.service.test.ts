import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutputService } from '../../services/output.service.js';

describe('OutputService', () => {
  let outputService: OutputService;

  beforeEach(() => {
    outputService = new OutputService();
    // Mock console.log to prevent logging during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('JSON Mode Formatting', () => {
    beforeEach(() => {
      outputService.enableJsonMode();
    });

    it('formats successful JSON envelope properly', () => {
      const data = { token: 'test-token', id: 123 };
      outputService.formatJsonOutput(data);

      expect(console.log).toHaveBeenCalledTimes(1);
      const logArg = (console.log as any).mock.calls[0][0];
      const parsed = JSON.parse(logArg);

      expect(parsed.status).toBe('SUCCESS');
      expect(parsed.data).toEqual(data);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('formats error JSON envelope properly on error() call', () => {
      outputService.error('Authentication failed');

      expect(console.log).toHaveBeenCalledTimes(1);
      const logArg = (console.log as any).mock.calls[0][0];
      const parsed = JSON.parse(logArg);

      expect(parsed.status).toBe('ERROR');
      expect(parsed.error.message).toBe('Authentication failed');
      expect(parsed.metadata.timestamp).toBeDefined();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('silences human-readable output in JSON mode', () => {
      outputService.success('Success message');
      outputService.info('Info message');
      outputService.warning('Warning message');
      outputService.progress('Progress message');

      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
