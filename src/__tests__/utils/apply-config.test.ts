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

  describe('new resource types (v1.17.0)', () => {
    it('should parse alert_channels array', () => {
      const result = normalizeApplyConfig({
        alert_channels: [
          { name: 'ch1', type: 'webhook', config: { webhook_url: 'https://x.com' } },
        ],
      });
      expect(result.alert_channels).toHaveLength(1);
    });

    it('should parse {"alert-channel": {...}}', () => {
      const result = normalizeApplyConfig({
        'alert-channel': { name: 'ch1', type: 'webhook' },
      });
      expect(result.alert_channels).toHaveLength(1);
    });

    it('should parse status_pages array', () => {
      const result = normalizeApplyConfig({
        status_pages: [{ slug: 'my-sp', name: 'My SP' }],
      });
      expect(result.status_pages).toHaveLength(1);
    });

    it('should parse {"status-page": {...}}', () => {
      const result = normalizeApplyConfig({
        'status-page': { slug: 'my-sp', name: 'My SP' },
      });
      expect(result.status_pages).toHaveLength(1);
    });

    it('should parse suites array', () => {
      const result = normalizeApplyConfig({
        suites: [{ suite_name: 'suite1', target_url: 'https://example.com' }],
      });
      expect(result.suites).toHaveLength(1);
    });

    it('should parse {"suite": {...}}', () => {
      const result = normalizeApplyConfig({
        suite: { suite_name: 'suite1', target_url: 'https://example.com' },
      });
      expect(result.suites).toHaveLength(1);
    });

    it('should parse incidents array', () => {
      const result = normalizeApplyConfig({
        incidents: [{ title: 'inc1', priority: 'LOW' }],
      });
      expect(result.incidents).toHaveLength(1);
    });

    it('should handle mixed new + existing types in one config', () => {
      const result = normalizeApplyConfig({
        monitors: [{ name: 'm1', url: 'https://example.com' }],
        alert_channels: [{ name: 'ch1', type: 'webhook' }],
        status_pages: [{ slug: 'sp1', name: 'SP 1' }],
      });
      expect(result.monitors).toHaveLength(1);
      expect(result.alert_channels).toHaveLength(1);
      expect(result.status_pages).toHaveLength(1);
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

  describe('surrogate id stripping', () => {
    it('strips bundle-local id from monitors so apply never forwards it', () => {
      const result = normalizeApplyConfig({
        monitors: [{ id: 42, name: 'm1', url: 'https://example.com' }],
      });
      expect(result.monitors?.[0]).not.toHaveProperty('id');
      expect(result.monitors?.[0].name).toBe('m1');
    });

    it('strips id from api_checks', () => {
      const result = normalizeApplyConfig({
        api_checks: [{ id: 7, name: 'c1', url: 'https://api.example.com', method: 'GET' }],
      });
      expect(result.api_checks?.[0]).not.toHaveProperty('id');
      expect(result.api_checks?.[0].name).toBe('c1');
    });

    it('strips id from alert_channels', () => {
      const result = normalizeApplyConfig({
        alert_channels: [{ id: 9, name: 'ch1', type: 'webhook' }],
      });
      expect(result.alert_channels?.[0]).not.toHaveProperty('id');
      expect(result.alert_channels?.[0].name).toBe('ch1');
    });

    it('strips id from a wrapped single resource', () => {
      const result = normalizeApplyConfig({
        monitor: { id: 13, name: 'm1', url: 'https://example.com' },
      });
      expect(result.monitors?.[0]).not.toHaveProperty('id');
    });

    it('strips id from a bare inferred resource', () => {
      const result = normalizeApplyConfig({
        id: 99,
        name: 'm1',
        url: 'https://example.com',
      });
      expect(result.monitors?.[0]).not.toHaveProperty('id');
    });

    it('leaves status_pages monitor_id / id references intact (not stripped)', () => {
      const result = normalizeApplyConfig({
        status_pages: [
          { slug: 'sp1', name: 'SP 1', monitors: [{ monitor_type: 'url_monitor', monitor_id: 5 }] },
        ],
      });
      const sp = result.status_pages?.[0] as { monitors?: Array<{ monitor_id?: number }> };
      expect(sp.monitors?.[0].monitor_id).toBe(5);
    });
  });
});
