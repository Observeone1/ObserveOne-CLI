import { describe, it, expect } from 'vitest';
import { normalizeApplyConfig } from '../../utils/apply-config.js';

describe('normalizeApplyConfig', () => {
  describe('plural config', () => {
    it('should parse monitors array', () => {
      const result = normalizeApplyConfig({
        monitors: [{ name: 'm1', url: 'https://example.com' }],
      });
      expect(result.monitors).toHaveLength(1);
      expect(result.monitors?.[0].name).toBe('m1');
    });

    it('should parse api_checks array', () => {
      const result = normalizeApplyConfig({
        api_checks: [{ name: 'c1', url: 'https://example.com', method: 'GET' }],
      });
      expect(result.api_checks).toHaveLength(1);
    });

    it('should parse heartbeats array', () => {
      const result = normalizeApplyConfig({ heartbeats: [{ name: 'h1', period: 60 }] });
      expect(result.heartbeats).toHaveLength(1);
    });

    it('should reject non-array value', () => {
      expect(() => normalizeApplyConfig({ monitors: 'not-array' })).toThrow(
        "'monitors' must be an array"
      );
    });
  });

  describe('wrapped config', () => {
    it('should parse {"monitor": {...}}', () => {
      const result = normalizeApplyConfig({ monitor: { name: 'm1', url: 'https://example.com' } });
      expect(result.monitors).toHaveLength(1);
    });

    it('should parse {"url-monitor": {...}}', () => {
      const result = normalizeApplyConfig({
        'url-monitor': { name: 'm1', url: 'https://example.com' },
      });
      expect(result.monitors).toHaveLength(1);
    });

    it('should parse {"check": {...}}', () => {
      const result = normalizeApplyConfig({ check: { name: 'c1', url: 'https://example.com' } });
      expect(result.api_checks).toHaveLength(1);
    });

    it('should parse {"api-check": {...}}', () => {
      const result = normalizeApplyConfig({
        'api-check': { name: 'c1', url: 'https://example.com' },
      });
      expect(result.api_checks).toHaveLength(1);
    });

    it('should parse {"heartbeat": {...}}', () => {
      const result = normalizeApplyConfig({ heartbeat: { name: 'h1', period: 60 } });
      expect(result.heartbeats).toHaveLength(1);
    });

    it('should reject multiple wrapped keys', () => {
      expect(() => normalizeApplyConfig({ monitor: {}, check: {} })).toThrow();
    });
  });

  describe('bare config with explicit type', () => {
    it('should parse {"type": "monitor", ...}', () => {
      const result = normalizeApplyConfig({
        type: 'monitor',
        name: 'm1',
        url: 'https://example.com',
      });
      expect(result.monitors).toHaveLength(1);
    });

    it('should parse {"type": "url-monitor", ...}', () => {
      const result = normalizeApplyConfig({
        type: 'url-monitor',
        name: 'm1',
        url: 'https://example.com',
      });
      expect(result.monitors).toHaveLength(1);
    });

    it('should parse {"type": "check", ...}', () => {
      const result = normalizeApplyConfig({
        type: 'check',
        name: 'c1',
        url: 'https://example.com',
      });
      expect(result.api_checks).toHaveLength(1);
    });

    it('should parse {"type": "api-check", ...}', () => {
      const result = normalizeApplyConfig({
        type: 'api-check',
        name: 'c1',
        url: 'https://example.com',
      });
      expect(result.api_checks).toHaveLength(1);
    });

    it('should parse {"type": "heartbeat", ...}', () => {
      const result = normalizeApplyConfig({ type: 'heartbeat', name: 'h1', period: 60 });
      expect(result.heartbeats).toHaveLength(1);
    });

    it('should parse {"resource": "monitor", ...}', () => {
      const result = normalizeApplyConfig({
        resource: 'monitor',
        name: 'm1',
        url: 'https://example.com',
      });
      expect(result.monitors).toHaveLength(1);
    });
  });

  describe('bare config inference', () => {
    it('should infer monitor from url', () => {
      const result = normalizeApplyConfig({ name: 'm1', url: 'https://example.com' });
      expect(result.monitors).toHaveLength(1);
    });

    it('should infer api_check from url + method', () => {
      const result = normalizeApplyConfig({
        name: 'c1',
        url: 'https://example.com',
        method: 'GET',
      });
      expect(result.api_checks).toHaveLength(1);
    });

    it('should infer heartbeat from period', () => {
      const result = normalizeApplyConfig({ name: 'h1', period: 60 });
      expect(result.heartbeats).toHaveLength(1);
    });

    it('should infer heartbeat from grace_period', () => {
      const result = normalizeApplyConfig({ name: 'h1', grace_period: 30 });
      expect(result.heartbeats).toHaveLength(1);
    });

    it('should infer heartbeat from ping_key', () => {
      const result = normalizeApplyConfig({ name: 'h1', ping_key: 'abc123' });
      expect(result.heartbeats).toHaveLength(1);
    });

    it('should infer ai_check from prompt', () => {
      const result = normalizeApplyConfig({ name: 'a1', prompt: 'check my page' });
      expect(result.ai_checks).toHaveLength(1);
    });
  });

  describe('error cases', () => {
    it('should reject non-object JSON', () => {
      expect(() => normalizeApplyConfig('not an object')).toThrow(
        'Apply file must contain a JSON object'
      );
    });

    it('should reject array', () => {
      expect(() => normalizeApplyConfig([{ name: 'm1' }])).toThrow(
        'Apply file must contain a JSON object'
      );
    });

    it('should reject empty object', () => {
      expect(() => normalizeApplyConfig({})).toThrow();
    });

    it('should reject ambiguous shape (no disambiguating field)', () => {
      expect(() => normalizeApplyConfig({ name: 'test' })).toThrow();
    });
  });

  describe('metadata key stripping', () => {
    it('should strip type from payload', () => {
      const result = normalizeApplyConfig({
        type: 'monitor',
        name: 'm1',
        url: 'https://example.com',
      });
      expect(result.monitors?.[0]).not.toHaveProperty('type');
    });

    it('should strip resource from payload', () => {
      const result = normalizeApplyConfig({
        resource: 'monitor',
        name: 'm1',
        url: 'https://example.com',
      });
      expect(result.monitors?.[0]).not.toHaveProperty('resource');
    });
  });
});
