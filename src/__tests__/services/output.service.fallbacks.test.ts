import { describe, it, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import { OutputService } from '../../services/output.service.js';
import {
  UrlMonitor,
  Heartbeat,
  Environment,
  Incident,
  ApiCheck,
  SslMonitor,
  ApiCollection,
  Schedule,
  AlertChannel,
  StatusPage,
} from '../../types/index.js';

function loggedLines(): string {
  return (console.log as Mock).mock.calls.map((call) => String(call[0])).join('\n');
}

/**
 * Covers the fallback/alternate rendering branches of the list formatters:
 * absent optional fields, non-verbose output, and the status colours that the
 * happy-path fixtures in output.service.test.ts never reach.
 */
describe('OutputService fallback rendering', () => {
  let outputService: OutputService;

  beforeEach(() => {
    outputService = new OutputService();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const baseMonitor: UrlMonitor = {
    id: 'm1',
    name: 'Homepage',
    url: 'https://example.com',
    timeout_ms: 5000,
    is_active: true,
    alert_on_failure: true,
    assertions: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  describe('status colours', () => {
    it('renders DOWN for a failing monitor and the raw text for an unrecognised status', () => {
      outputService.formatMonitorList([{ ...baseMonitor, status: 'down' }]);
      expect(loggedLines()).toContain('DOWN');

      vi.clearAllMocks();
      outputService.formatMonitorList([
        { ...baseMonitor, status: 'pending' } as unknown as UrlMonitor,
      ]);
      expect(loggedLines()).toContain('PENDING');
    });

    it('derives UP from is_active when the monitor carries no status field', () => {
      const { status: _unused, ...noStatus } = { ...baseMonitor, status: undefined };
      outputService.formatMonitorList([noStatus as UrlMonitor]);
      expect(loggedLines()).toContain('UP');
    });
  });

  describe('formatMonitorList', () => {
    it('omits description and reports OFF alerts / explicit interval when verbose', () => {
      outputService.formatMonitorList(
        [{ ...baseMonitor, interval: '5m', alert_on_failure: false } as UrlMonitor],
        true
      );
      const out = loggedLines();
      expect(out).toContain('Interval: 5m');
      expect(out).toContain('Alerts: OFF');
      expect(out).not.toContain('Desc:');
    });

    it('hides verbose-only fields when verbose is not requested', () => {
      outputService.formatMonitorList([{ ...baseMonitor, description: 'hidden detail' }]);
      const out = loggedLines();
      expect(out).toContain('Homepage');
      expect(out).not.toContain('hidden detail');
      expect(out).not.toContain('Interval:');
    });
  });

  describe('formatProtocolMonitorList', () => {
    const baseProtocol: SslMonitor = {
      id: 'p1',
      name: 'cert check',
      hostname: 'example.com',
      port: 443,
      warn_days: 30,
      timeout_ms: 5000,
      status: 'up',
      is_active: true,
      alert_on_failure: true,
      cron_expression: '0 0 * * *',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('drops the port suffix and prefixes the protocol when present', () => {
      const { port: _p, ...noPort } = baseProtocol;
      outputService.formatProtocolMonitorList([
        { ...noPort, protocol: 'tcp' } as unknown as SslMonitor,
      ]);
      const out = loggedLines();
      expect(out).toContain('Target: tcp example.com');
      expect(out).not.toContain('example.com:');
    });

    it('falls back to host, then to "?", when hostname is missing', () => {
      const { hostname: _h, ...noHostname } = baseProtocol;
      outputService.formatProtocolMonitorList([
        { ...noHostname, host: '10.0.0.5' } as unknown as SslMonitor,
      ]);
      expect(loggedLines()).toContain('Target: 10.0.0.5:443');

      vi.clearAllMocks();
      outputService.formatProtocolMonitorList([noHostname as unknown as SslMonitor]);
      expect(loggedLines()).toContain('Target: ?:443');
    });

    it('reports a Default interval and OFF alerts when verbose and those fields are unset', () => {
      const { cron_expression: _c, ...noCron } = baseProtocol;
      outputService.formatProtocolMonitorList(
        [{ ...noCron, alert_on_failure: false } as unknown as SslMonitor],
        true
      );
      const out = loggedLines();
      expect(out).toContain('Interval: Default');
      expect(out).toContain('Alerts: OFF');
      expect(out).not.toContain('Desc:');
    });

    it('defaults the heading label to "Protocol" when none is supplied', () => {
      outputService.formatProtocolMonitorList([]);
      expect(loggedLines()).toContain('No Protocol monitors found.');
    });
  });

  describe('formatApiCheckList', () => {
    const baseCheck: ApiCheck = {
      id: 'c1',
      name: 'Health check',
      url: 'https://api.example.com/health',
      method: 'GET',
      timeout_ms: 5000,
      is_active: true,
      alert_on_failure: true,
      assertions: [],
    };

    it('counts zero assertions and omits the description when both are absent', () => {
      const { assertions: _a, ...noAssertions } = baseCheck;
      outputService.formatApiCheckList([noAssertions as ApiCheck], true);
      const out = loggedLines();
      expect(out).toContain('Assertions: 0');
      expect(out).not.toContain('Desc:');
    });

    it('hides assertion counts when not verbose', () => {
      outputService.formatApiCheckList([baseCheck]);
      const out = loggedLines();
      expect(out).toContain('GET https://api.example.com/health');
      expect(out).not.toContain('Assertions:');
    });
  });

  describe('formatHeartbeatList', () => {
    const baseHeartbeat: Heartbeat = {
      id: 'h1',
      name: 'Cron job',
      period: 300,
      grace_period: 60,
      ping_key: 'abc123',
      is_active: true,
      alert_on_failure: true,
      status: 'up',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('renders DOWN and the warning fallback status text', () => {
      outputService.formatHeartbeatList([{ ...baseHeartbeat, status: 'down' }]);
      expect(loggedLines()).toContain('DOWN');

      vi.clearAllMocks();
      outputService.formatHeartbeatList([{ ...baseHeartbeat, status: 'late' }]);
      expect(loggedLines()).toContain('LATE');
    });

    it('formats a real last-ping timestamp when one exists', () => {
      outputService.formatHeartbeatList(
        [{ ...baseHeartbeat, last_ping_at: '2026-06-15T12:00:00Z' }],
        true
      );
      const out = loggedLines();
      expect(out).toContain('Last Ping:');
      expect(out).toContain('2026');
      expect(out).not.toContain('Never');
    });

    it('omits period and last-ping lines when not verbose', () => {
      outputService.formatHeartbeatList([baseHeartbeat]);
      const out = loggedLines();
      expect(out).toContain('abc123');
      expect(out).not.toContain('Period:');
      expect(out).not.toContain('Last Ping:');
    });
  });

  describe('formatEnvironmentList', () => {
    const baseEnv: Environment = {
      id: 'e1',
      name: 'production',
      variables: {},
      secret_keys: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('prints an empty-state message when there are no environments', () => {
      outputService.formatEnvironmentList([]);
      expect(loggedLines()).toContain('No environments found.');
    });

    it('counts absent variables and secrets as zero and omits the base URL line', () => {
      const { variables: _v, secret_keys: _s, ...bare } = baseEnv;
      outputService.formatEnvironmentList([bare as Environment], true);
      const out = loggedLines();
      expect(out).toContain('Variables: 0  Secrets: 0');
      expect(out).not.toContain('Base URL:');
    });

    it('prints the base URL but no variable values when not verbose', () => {
      outputService.formatEnvironmentList([
        { ...baseEnv, base_url: 'https://api.example.com', variables: { REGION: 'us-east-1' } },
      ]);
      const out = loggedLines();
      expect(out).toContain('Base URL: https://api.example.com');
      expect(out).not.toContain('REGION=us-east-1');
    });
  });

  describe('formatApiCollectionList', () => {
    const baseCollection: ApiCollection = {
      id: 'ac1',
      name: 'Billing API',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('counts absent headers as zero, omits the base URL, and lists no header entries', () => {
      outputService.formatApiCollectionList([baseCollection], true);
      const out = loggedLines();
      expect(out).toContain('Headers: 0');
      expect(out).not.toContain('Base URL:');
    });

    it('prints the base URL and header count but no entries when not verbose', () => {
      outputService.formatApiCollectionList([
        {
          ...baseCollection,
          base_url: 'https://api.example.com',
          headers: { Authorization: 'Bearer x' },
        },
      ]);
      const out = loggedLines();
      expect(out).toContain('Base URL: https://api.example.com');
      expect(out).toContain('Headers: 1');
      expect(out).not.toContain('Bearer x');
    });
  });

  describe('formatScheduleList', () => {
    const baseSchedule: Schedule = {
      id: 's1',
      test_id: 't1',
      cron_expression: '0 * * * *',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('marks an inactive schedule PAUSED', () => {
      outputService.formatScheduleList([{ ...baseSchedule, is_active: false }]);
      expect(loggedLines()).toContain('PAUSED');
    });

    it('formats real run timestamps and omits the retry line when retry_count is unset', () => {
      outputService.formatScheduleList(
        [
          {
            ...baseSchedule,
            next_run_at: '2026-06-15T12:00:00Z',
            last_run_at: '2026-06-15T11:00:00Z',
            alert_on_failure: false,
          },
        ],
        true
      );
      const out = loggedLines();
      expect(out).toContain('2026');
      expect(out).not.toContain('n/a');
      expect(out).not.toContain('Never');
      expect(out).toContain('Alerts: OFF');
      expect(out).not.toContain('Retries:');
    });

    it('prints retries without an interval when retry_interval is null', () => {
      outputService.formatScheduleList(
        [{ ...baseSchedule, retry_count: 3, retry_interval: null }],
        true
      );
      const out = loggedLines();
      expect(out).toContain('Retries: 3');
      expect(out).not.toContain('every');
    });

    it('prints retries with the interval when both are set', () => {
      outputService.formatScheduleList(
        [{ ...baseSchedule, retry_count: 2, retry_interval: 30 }],
        true
      );
      expect(loggedLines()).toContain('Retries: 2 (every 30s)');
    });

    it('omits run details entirely when not verbose', () => {
      outputService.formatScheduleList([baseSchedule]);
      const out = loggedLines();
      expect(out).toContain('0 * * * *');
      expect(out).not.toContain('Next run:');
    });
  });

  describe('formatAlertChannelList', () => {
    const baseChannel: AlertChannel = {
      id: 'ch1',
      name: 'Ops email',
      type: 'email',
      config: {},
      is_default: false,
    };

    it('marks a non-default channel CUSTOM and reports None for an empty config', () => {
      outputService.formatAlertChannelList([baseChannel], true);
      const out = loggedLines();
      expect(out).toContain('CUSTOM');
      expect(out).toContain('Config keys: None');
    });

    it('lists config keys for a default channel', () => {
      outputService.formatAlertChannelList(
        [{ ...baseChannel, is_default: true, config: { email: 'ops@example.com' } }],
        true
      );
      const out = loggedLines();
      expect(out).toContain('DEFAULT');
      expect(out).toContain('Config keys: email');
    });

    it('omits the config line when not verbose', () => {
      outputService.formatAlertChannelList([baseChannel]);
      expect(loggedLines()).not.toContain('Config keys:');
    });
  });

  describe('formatStatusPageList', () => {
    const basePage: StatusPage = {
      id: 'sp1',
      slug: 'status',
      name: 'Public status',
      is_public: true,
      show_incident_history: true,
      show_uptime_percentage: true,
    };

    it('marks a non-public page PRIVATE and omits absent theme colours', () => {
      outputService.formatStatusPageList([{ ...basePage, is_public: false }], true);
      const out = loggedLines();
      expect(out).toContain('PRIVATE');
      expect(out).not.toContain('Theme Primary:');
      expect(out).not.toContain('Theme Background:');
      expect(out).not.toContain('Desc:');
    });

    it('prints both theme colours when they are set', () => {
      outputService.formatStatusPageList(
        [{ ...basePage, theme_primary_color: '#112233', theme_background_color: '#ffffff' }],
        true
      );
      const out = loggedLines();
      expect(out).toContain('Theme Primary: #112233');
      expect(out).toContain('Theme Background: #ffffff');
    });

    it('omits theme details when not verbose', () => {
      outputService.formatStatusPageList([{ ...basePage, theme_primary_color: '#112233' }]);
      const out = loggedLines();
      expect(out).toContain('Slug: status');
      expect(out).not.toContain('Theme Primary:');
    });

    it('prints the description when verbose and one is set', () => {
      outputService.formatStatusPageList([{ ...basePage, description: 'customer facing' }], true);
      expect(loggedLines()).toContain('Desc: customer facing');
    });
  });

  describe('verbose descriptions and empty collections', () => {
    it('prints a URL monitor description when verbose', () => {
      outputService.formatMonitorList([{ ...baseMonitor, description: 'front door' }], true);
      expect(loggedLines()).toContain('Desc: front door');
    });

    it('prints a protocol monitor description and derives status from is_active', () => {
      const protocolMonitor = {
        id: 'p1',
        name: 'cert check',
        hostname: 'example.com',
        port: 443,
        is_active: true,
        alert_on_failure: true,
        description: 'tls expiry',
      };
      outputService.formatProtocolMonitorList([protocolMonitor as unknown as SslMonitor], true);
      const out = loggedLines();
      expect(out).toContain('Desc: tls expiry');
      expect(out).toContain('UP');

      vi.clearAllMocks();
      outputService.formatProtocolMonitorList([
        { ...protocolMonitor, is_active: false } as unknown as SslMonitor,
      ]);
      expect(loggedLines()).toContain('PAUSED');
    });

    it('derives an API check status from is_active when none is reported', () => {
      const check = {
        id: 'c1',
        name: 'Health check',
        url: 'https://api.example.com/health',
        method: 'GET',
        timeout_ms: 5000,
        is_active: false,
        alert_on_failure: true,
        assertions: [],
      };
      outputService.formatApiCheckList([check as ApiCheck]);
      expect(loggedLines()).toContain('PAUSED');
    });

    it('prints nothing extra for an environment whose variables map is empty', () => {
      outputService.formatEnvironmentList(
        [
          {
            id: 'e1',
            name: 'staging',
            variables: {},
            secret_keys: [],
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        true
      );
      const out = loggedLines();
      expect(out).toContain('Variables: 0  Secrets: 0');
      expect(out).not.toContain('Secret keys:');
    });

    it('lists secret key names but never values when verbose', () => {
      outputService.formatEnvironmentList(
        [
          {
            id: 'e1',
            name: 'production',
            variables: {},
            secret_keys: ['DB_PASSWORD', 'API_TOKEN'],
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        true
      );
      expect(loggedLines()).toContain('Secret keys: DB_PASSWORD, API_TOKEN');
    });

    it('lists collection header entries when verbose and headers exist', () => {
      outputService.formatApiCollectionList(
        [
          {
            id: 'ac1',
            name: 'Billing API',
            headers: { Authorization: 'Bearer abc' },
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        true
      );
      expect(loggedLines()).toContain('Authorization: Bearer abc');
    });

    it('reports None for an alert channel with no config object at all', () => {
      outputService.formatAlertChannelList(
        [
          {
            id: 'ch1',
            name: 'Ops email',
            type: 'email',
            is_default: false,
          } as unknown as AlertChannel,
        ],
        true
      );
      expect(loggedLines()).toContain('Config keys: None');
    });
  });

  describe('formatIncidentList', () => {
    const baseIncident: Incident = {
      id: 'i1',
      title: 'Checkout down',
      status: 'OPEN',
      priority: 'HIGH',
    };

    it('omits the assignment line when nobody is assigned and no description exists', () => {
      outputService.formatIncidentList([baseIncident], true);
      const out = loggedLines();
      expect(out).toContain('[High] (OPEN)');
      expect(out).not.toContain('Assigned:');
      expect(out).not.toContain('Desc:');
    });

    it('hides the description when not verbose', () => {
      outputService.formatIncidentList([{ ...baseIncident, description: 'hidden detail' }]);
      expect(loggedLines()).not.toContain('hidden detail');
    });
  });

  describe('formatJUnitReport', () => {
    it('emits an empty failure body when a failed case carries no stack trace', () => {
      const xml = outputService.formatJUnitReport({
        name: 'suite',
        tests: 1,
        failures: 1,
        errors: 0,
        time: '1.0',
        testCases: [
          {
            name: 'case',
            classname: 'cls',
            time: '1.0',
            status: 'failed',
            failure: { message: 'boom', type: 'AssertionError' },
          },
        ],
      });
      expect(xml).toContain('<failure message="boom" type="AssertionError">');
      expect(xml).toContain('\r\n\r\n    </failure>');
    });

    it('escapes every reserved XML character in names and messages', () => {
      const xml = outputService.formatJUnitReport({
        name: `a<b>c&d'e"f`,
        tests: 1,
        failures: 0,
        errors: 0,
        time: '0.1',
        testCases: [],
      });
      expect(xml).toContain('a&lt;b&gt;c&amp;d&apos;e&quot;f');
    });
  });
});
