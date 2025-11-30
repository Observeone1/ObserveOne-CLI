import { OutputFormatter } from '../utils/output';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('OutputFormatter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('success', () => {
    it('should log success message with green color', () => {
      OutputFormatter.success('Test passed');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✅ Test passed'));
    });
  });

  describe('error', () => {
    it('should log error message with red color', () => {
      OutputFormatter.error('Test failed');
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('❌ Test failed'));
    });
  });

  describe('warning', () => {
    it('should log warning message with yellow color', () => {
      OutputFormatter.warning('Test warning');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('⚠️  Test warning'));
    });
  });

  describe('info', () => {
    it('should log info message with blue color', () => {
      OutputFormatter.info('Test info');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('ℹ️  Test info'));
    });
  });

  describe('progress', () => {
    it('should log progress message with cyan color', () => {
      OutputFormatter.progress('Test progress');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('🔄 Test progress'));
    });
  });

  describe('formatTestList', () => {
    it('should format empty test list', () => {
      OutputFormatter.formatTestList([]);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('No tests found'));
    });

    it('should format test list with tests', () => {
      const tests = [
        {
          id: 1,
          name: 'Test 1',
          description: 'Test description',
          url: 'https://example.com',
          prompt: 'Test prompt',
          user_id: 'user123',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];

      OutputFormatter.formatTestList(tests);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Available Tests'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test 1'));
    });
  });

  describe('formatTestExecution', () => {
    it('should format test execution status', () => {
      const execution = {
        id: 123,
        test_id: 1,
        status: 'SUCCESS' as const,
        started_at: '2023-01-01T00:00:00Z',
        completed_at: '2023-01-01T00:01:00Z'
      };

      OutputFormatter.formatTestExecution(execution);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test Execution Status'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('SUCCESS'));
    });
  });

  describe('formatTestResult', () => {
    it('should format test result', () => {
      const result = {
        status: 'SUCCESS' as const,
        message: 'Test completed',
        executionId: 123,
        taskId: 'task-123'
      };

      OutputFormatter.formatTestResult(result);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test Result'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('SUCCESS'));
    });
  });

  describe('formatJsonOutput', () => {
    it('should format JSON output', () => {
      const data = { test: 'value' };
      OutputFormatter.formatJsonOutput(data);
      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });
  });

  describe('formatJUnitReport', () => {
    it('should format JUnit XML report', () => {
      const testSuite = {
        name: 'Test Suite',
        tests: 2,
        failures: 1,
        errors: 0,
        time: 1.5,
        testCases: [
          {
            name: 'Test 1',
            classname: 'TestClass',
            time: 1.0,
            status: 'passed'
          },
          {
            name: 'Test 2',
            classname: 'TestClass',
            time: 0.5,
            status: 'failed',
            failure: {
              message: 'Test failed',
              type: 'AssertionError',
              stackTrace: 'Stack trace'
            }
          }
        ]
      };

      const result = OutputFormatter.formatJUnitReport(testSuite);
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<testsuite');
      expect(result).toContain('<testcase');
      expect(result).toContain('<failure');
    });
  });

  describe('formatError', () => {
    it('should format API error', () => {
      const error = {
        response: {
          status: 404,
          data: { error: 'Not found' }
        }
      };

      const result = OutputFormatter.formatError(error);
      expect(result).toContain('API Error (404)');
      expect(result).toContain('Not found');
    });

    it('should format network error', () => {
      const error = {
        request: {},
        message: 'Network error'
      };

      const result = OutputFormatter.formatError(error);
      expect(result).toContain('Network Error');
    });

    it('should format generic error', () => {
      const error = new Error('Generic error');
      const result = OutputFormatter.formatError(error);
      expect(result).toBe('Generic error');
    });
  });
});
