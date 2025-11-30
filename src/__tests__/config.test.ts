import { ConfigManager } from '../utils/config';

// Mock conf
jest.mock('conf');
const MockConf = require('conf');

describe('ConfigManager', () => {
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      path: '/mock/config/path'
    };
    
    MockConf.mockImplementation(() => mockConfig);
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return config store', () => {
      const mockStore = { apiUrl: 'https://api.example.com' };
      mockConfig.store = mockStore;

      const result = ConfigManager.getConfig();
      expect(result).toEqual(mockStore);
    });
  });

  describe('getApiUrl', () => {
    it('should return API URL from config', () => {
      mockConfig.get.mockReturnValue('https://api.example.com');

      const result = ConfigManager.getApiUrl();
      expect(result).toBe('https://api.example.com');
      expect(mockConfig.get).toHaveBeenCalledWith('apiUrl', 'https://api.obs1.com');
    });

    it('should return default API URL when not set', () => {
      mockConfig.get.mockReturnValue(undefined);

      const result = ConfigManager.getApiUrl();
      expect(result).toBe('https://api.obs1.com');
    });
  });

  describe('getApiKey', () => {
    it('should return API key from config', () => {
      mockConfig.get.mockReturnValue('test-api-key');

      const result = ConfigManager.getApiKey();
      expect(result).toBe('test-api-key');
      expect(mockConfig.get).toHaveBeenCalledWith('apiKey');
    });

    it('should return undefined when not set', () => {
      mockConfig.get.mockReturnValue(undefined);

      const result = ConfigManager.getApiKey();
      expect(result).toBeUndefined();
    });
  });

  describe('setApiUrl', () => {
    it('should set API URL in config', () => {
      ConfigManager.setApiUrl('https://api.example.com');
      
      expect(mockConfig.set).toHaveBeenCalledWith('apiUrl', 'https://api.example.com');
    });
  });

  describe('setApiKey', () => {
    it('should set API key in config', () => {
      ConfigManager.setApiKey('test-api-key');
      
      expect(mockConfig.set).toHaveBeenCalledWith('apiKey', 'test-api-key');
    });
  });

  describe('clearApiKey', () => {
    it('should delete API key from config', () => {
      ConfigManager.clearApiKey();
      
      expect(mockConfig.delete).toHaveBeenCalledWith('apiKey');
    });
  });

  describe('reset', () => {
    it('should clear all config', () => {
      ConfigManager.reset();
      
      expect(mockConfig.clear).toHaveBeenCalled();
    });
  });

  describe('getConfigPath', () => {
    it('should return config path', () => {
      const result = ConfigManager.getConfigPath();
      expect(result).toBe('/mock/config/path');
    });
  });
});



