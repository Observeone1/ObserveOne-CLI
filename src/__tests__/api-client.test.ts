import { ApiClient } from '../utils/api-client';
import { ConfigManager } from '../utils/config';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('ApiClient', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    apiClient = new ApiClient();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(apiClient).toBeDefined();
    });
  });

  describe('setApiKey', () => {
    it('should set API key in headers', () => {
      const mockApiKey = 'test-api-key';
      apiClient.setApiKey(mockApiKey);
      
      // Verify axios create was called with correct headers
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`
          })
        })
      );
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({
          data: { valid: true }
        })
      });

      const result = await apiClient.validateToken();
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('Unauthorized'))
      });

      const result = await apiClient.validateToken();
      expect(result).toBe(false);
    });
  });

  describe('getTests', () => {
    it('should fetch tests successfully', async () => {
      const mockTests = [
        { id: 1, name: 'Test 1', url: 'https://example.com' },
        { id: 2, name: 'Test 2', url: 'https://example2.com' }
      ];

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: mockTests
        })
      });

      const result = await apiClient.getTests();
      expect(result).toEqual(mockTests);
    });
  });

  describe('executeTest', () => {
    it('should execute test successfully', async () => {
      const mockResult = {
        status: 'SUCCESS',
        message: 'Test completed',
        executionId: 123
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({
          data: mockResult
        })
      });

      const result = await apiClient.executeTest(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe('pollExecutionStatus', () => {
    it('should poll until completion', async () => {
      const mockExecution = {
        id: 123,
        status: 'SUCCESS',
        test_id: 1
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn()
          .mockResolvedValueOnce({ data: { ...mockExecution, status: 'RUNNING' } })
          .mockResolvedValueOnce({ data: { ...mockExecution, status: 'RUNNING' } })
          .mockResolvedValueOnce({ data: mockExecution })
      });

      const result = await apiClient.pollExecutionStatus(123, 3, 100);
      expect(result).toEqual(mockExecution);
    });

    it('should timeout if execution does not complete', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: { id: 123, status: 'RUNNING', test_id: 1 }
        })
      });

      await expect(apiClient.pollExecutionStatus(123, 2, 100))
        .rejects.toThrow('Test execution 123 did not complete within the timeout period');
    });
  });
});



