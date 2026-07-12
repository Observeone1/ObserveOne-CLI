import { describe, it, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import { OutputService } from '../../services/output.service.js';
import {
  UrlMonitor,
  Heartbeat,
  Environment,
  Incident,
  ApiCheck,
  SslMonitor,
  Project,
  ApiCollection,
  Schedule,
  AlertChannel,
  StatusPage,
} from '../../types/index.js';

function loggedLines(): string {
  return (console.log as Mock).mock.calls.map((call) => String(call[0])).join('\n');
}

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
      const logArg = (console.log as Mock).mock.calls[0][0] as string;
      const parsed = JSON.parse(logArg);

      expect(parsed.status).toBe('SUCCESS');
      expect(parsed.data).toEqual(data);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('formats error JSON envelope properly on error() call', () => {
      outputService.error('Authentication failed');

      expect(console.log).toHaveBeenCalledTimes(1);
      const logArg = (console.log as Mock).mock.calls[0][0] as string;
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

  describe('human-readable message methods', () => {
    it('success/warning/info/progress write to console.log', () => {
      outputService.success('created');
      outputService.warning('careful');
      outputService.info('fyi');
      outputService.progress('working...');

      const out = loggedLines();
      expect(out).toContain('created');
      expect(out).toContain('careful');
      expect(out).toContain('fyi');
      expect(out).toContain('working...');
      expect(console.error).not.toHaveBeenCalled();
    });

    it('error() writes to console.error, not console.log, outside JSON mode', () => {
      outputService.error('boom');
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(String((console.error as Mock).mock.calls[0][0])).toContain('boom');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('list formatters', () => {
    it('formatMonitorList prints an empty-state info message when there are no monitors', () => {
      outputService.formatMonitorList([]);
      expect(loggedLines()).toContain('No URL monitors found.');
    });

    it('formatMonitorList prints name/status/url for each monitor, verbose adds extra fields', () => {
      const monitors: UrlMonitor[] = [
        {
          id: 'm1',
          name: 'Homepage',
          url: 'https://example.com',
          timeout_ms: 5000,
          status: 'up',
          is_active: true,
          alert_on_failure: true,
          assertions: [],
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      outputService.formatMonitorList(monitors, true);
      const out = loggedLines();
      expect(out).toContain('Homepage');
      expect(out).toContain('UP');
      expect(out).toContain('https://example.com');
      expect(out).toContain('Interval: Default');
      expect(out).toContain('Alerts: ON');
    });

    it('formatMonitorList falls back to paused/down status text when status is absent', () => {
      const monitors: UrlMonitor[] = [
        {
          id: 'm2',
          name: 'Paused monitor',
          url: 'https://example.com',
          timeout_ms: 5000,
          is_active: false,
          alert_on_failure: false,
          assertions: [],
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      outputService.formatMonitorList(monitors);
      expect(loggedLines()).toContain('PAUSED');
    });

    it('formatHeartbeatList prints empty state and per-heartbeat details', () => {
      outputService.formatHeartbeatList([]);
      expect(loggedLines()).toContain('No heartbeats found.');

      vi.clearAllMocks();
      const heartbeats: Heartbeat[] = [
        {
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
        },
      ];
      outputService.formatHeartbeatList(heartbeats, true);
      const out = loggedLines();
      expect(out).toContain('Cron job');
      expect(out).toContain('abc123');
      expect(out).toContain('Grace: 60s');
      expect(out).toContain('Never');
    });

    it('formatEnvironmentList prints an empty-state info message when there are no environments', () => {
      outputService.formatEnvironmentList([]);
      expect(loggedLines()).toContain('No environments found.');
    });

    it('formatEnvironmentList shows variable/secret counts and, when verbose, their values', () => {
      const environments: Environment[] = [
        {
          id: 'e1',
          name: 'production',
          base_url: 'https://api.example.com',
          variables: { REGION: 'us-east-1' },
          secret_keys: ['DB_PASSWORD'],
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      outputService.formatEnvironmentList(environments, true);
      const out = loggedLines();
      expect(out).toContain('production');
      expect(out).toContain('Variables: 1  Secrets: 1');
      expect(out).toContain('REGION=us-east-1');
      expect(out).toContain('DB_PASSWORD');
    });

    it('formatIncidentList capitalizes priority and shows assignment/description when present', () => {
      const incidents: Incident[] = [
        {
          id: 'i1',
          title: 'Checkout down',
          status: 'OPEN',
          priority: 'CRITICAL',
          assigned_to: 'oncall@example.com',
          description: 'Payments API returning 500s',
        },
      ];
      outputService.formatIncidentList(incidents, true);
      const out = loggedLines();
      expect(out).toContain('Checkout down');
      expect(out).toContain('Critical');
      expect(out).toContain('oncall@example.com');
      expect(out).toContain('Payments API returning 500s');
    });

    it('formatIncidentList empty state', () => {
      outputService.formatIncidentList([]);
      expect(loggedLines()).toContain('No incidents found.');
    });

    it('formatApiCheckList prints method/url and, when verbose, description/assertion count', () => {
      outputService.formatApiCheckList([]);
      expect(loggedLines()).toContain('No API checks found.');

      vi.clearAllMocks();
      const checks: ApiCheck[] = [
        {
          id: 'c1',
          name: 'Health check',
          url: 'https://api.example.com/health',
          method: 'GET',
          status: 'down',
          timeout_ms: 5000,
          is_active: true,
          alert_on_failure: true,
          description: 'pings /health',
          assertions: [{ type: 'status', operator: 'eq', value: '200' }],
        },
      ];
      outputService.formatApiCheckList(checks, true);
      const out = loggedLines();
      expect(out).toContain('Health check');
      expect(out).toContain('DOWN');
      expect(out).toContain('GET https://api.example.com/health');
      expect(out).toContain('pings /health');
      expect(out).toContain('Assertions: 1');
    });

    it('formatProtocolMonitorList uses the given label and derives the target from host/port/protocol', () => {
      outputService.formatProtocolMonitorList([], false, 'SSL');
      expect(loggedLines()).toContain('No SSL monitors found.');

      vi.clearAllMocks();
      const monitors: SslMonitor[] = [
        {
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
        },
      ];
      outputService.formatProtocolMonitorList(monitors, true, 'SSL');
      const out = loggedLines();
      expect(out).toContain('SSL Monitors');
      expect(out).toContain('cert check');
      expect(out).toContain('example.com:443');
      expect(out).toContain('Interval: 0 0 * * *');
    });

    it('formatProjectList shows description only when verbose', () => {
      outputService.formatProjectList([]);
      expect(loggedLines()).toContain('No projects found.');

      vi.clearAllMocks();
      const projects: Project[] = [
        {
          id: 'pr1',
          name: 'Storefront',
          description: 'Main e-commerce project',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      outputService.formatProjectList(projects);
      expect(loggedLines()).not.toContain('Main e-commerce project');

      vi.clearAllMocks();
      outputService.formatProjectList(projects, true);
      expect(loggedLines()).toContain('Main e-commerce project');
    });

    it('formatApiCollectionList shows header count and, when verbose, header entries', () => {
      outputService.formatApiCollectionList([]);
      expect(loggedLines()).toContain('No API collections found.');

      vi.clearAllMocks();
      const collections: ApiCollection[] = [
        {
          id: 'col1',
          name: 'Public API',
          base_url: 'https://api.example.com',
          headers: { 'X-Api-Key': 'secret' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      outputService.formatApiCollectionList(collections, true);
      const out = loggedLines();
      expect(out).toContain('Public API');
      expect(out).toContain('Headers: 1');
      expect(out).toContain('X-Api-Key: secret');
    });

    it('formatScheduleList shows active/paused state and, when verbose, run history and retries', () => {
      outputService.formatScheduleList([]);
      expect(loggedLines()).toContain('No schedules found.');

      vi.clearAllMocks();
      const schedules: Schedule[] = [
        {
          id: 's1',
          test_id: 't1',
          cron_expression: '0 */6 * * *',
          is_active: true,
          alert_on_failure: true,
          retry_count: 3,
          retry_interval: 30,
          next_run_at: '2026-01-02T00:00:00Z',
          last_run_at: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      outputService.formatScheduleList(schedules, true);
      const out = loggedLines();
      expect(out).toContain('ACTIVE');
      expect(out).toContain('Retries: 3 (every 30s)');
      expect(out).toContain('Never');
    });

    it('formatAlertChannelList marks the default channel and lists config keys when verbose', () => {
      outputService.formatAlertChannelList([]);
      expect(loggedLines()).toContain('No alert channels found.');

      vi.clearAllMocks();
      const channels: AlertChannel[] = [
        {
          id: 'ch1',
          name: 'Primary email',
          type: 'email',
          config: { email: 'alerts@example.com' },
          is_default: true,
        },
      ];
      outputService.formatAlertChannelList(channels, true);
      const out = loggedLines();
      expect(out).toContain('DEFAULT');
      expect(out).toContain('Config keys: email');
    });

    it('formatStatusPageList marks visibility and, when verbose, shows theme colors', () => {
      outputService.formatStatusPageList([]);
      expect(loggedLines()).toContain('No status pages found.');

      vi.clearAllMocks();
      const pages: StatusPage[] = [
        {
          id: 'sp1',
          slug: 'status',
          name: 'Public status',
          is_public: true,
          show_incident_history: true,
          show_uptime_percentage: true,
          theme_primary_color: '#000000',
          theme_background_color: '#ffffff',
        },
      ];
      outputService.formatStatusPageList(pages, true);
      const out = loggedLines();
      expect(out).toContain('PUBLIC');
      expect(out).toContain('Theme Primary: #000000');
      expect(out).toContain('Theme Background: #ffffff');
    });
  });

  describe('formatJUnitReport', () => {
    it('renders a passing test case without a <failure> element', () => {
      const xml = outputService.formatJUnitReport({
        name: 'suite-1',
        tests: 1,
        failures: 0,
        errors: 0,
        time: '1.2',
        testCases: [{ name: 'loads', classname: 'suite-1', time: '1.2', status: 'passed' }],
      });

      expect(xml).toContain('<testsuite name="suite-1" tests="1" failures="0" errors="0"');
      expect(xml).toContain('<testcase name="loads" classname="suite-1" time="1.2">');
      expect(xml).not.toContain('<failure');
      expect(xml).not.toContain('<skipped');
    });

    it('renders a <failure> block with escaped message/type/stack for failed cases', () => {
      const xml = outputService.formatJUnitReport({
        name: 'suite & test',
        tests: 1,
        failures: 1,
        errors: 0,
        time: '0.5',
        testCases: [
          {
            name: 'checks <title>',
            classname: 'suite',
            time: '0.5',
            status: 'failed',
            failure: {
              message: 'expected "a" to equal "b"',
              type: 'AssertionError',
              stackTrace: 'at line 1',
            },
          },
        ],
      });

      expect(xml).toContain('suite &amp; test');
      expect(xml).toContain('checks &lt;title&gt;');
      expect(xml).toContain('<failure message="expected &quot;a&quot; to equal &quot;b&quot;"');
      expect(xml).toContain('type="AssertionError"');
      expect(xml).toContain('at line 1');
    });

    it('escapes apostrophes and leaves other characters untouched', () => {
      const xml = outputService.formatJUnitReport({
        name: "it's a suite",
        tests: 1,
        failures: 0,
        errors: 0,
        time: '0',
        testCases: [{ name: 'plain-name-123', classname: 'suite', time: '0', status: 'passed' }],
      });

      expect(xml).toContain('it&apos;s a suite');
      expect(xml).toContain('plain-name-123');
    });

    it('renders a self-closing <skipped/> for skipped cases', () => {
      const xml = outputService.formatJUnitReport({
        name: 'suite-1',
        tests: 1,
        failures: 0,
        errors: 0,
        time: '0',
        testCases: [{ name: 'skipped-test', classname: 'suite-1', time: '0', status: 'skipped' }],
      });

      expect(xml).toContain('<skipped/>');
    });
  });

  describe('formatError', () => {
    it('formats an API error using response status and error/message body', () => {
      const result = outputService.formatError({
        response: { status: 404, data: { error: 'Not found' } },
      });
      expect(result).toBe('API Error (404): Not found');
    });

    it('falls back to data.message when data.error is absent', () => {
      const result = outputService.formatError({
        response: { status: 500, data: { message: 'Internal error' } },
      });
      expect(result).toBe('API Error (500): Internal error');
    });

    it('falls back to the top-level error message when no data body is present', () => {
      const result = outputService.formatError({
        response: { status: 502 },
        message: 'Bad Gateway',
      });
      expect(result).toBe('API Error (502): Bad Gateway');
    });

    it('reports a network error when the request was made but no response arrived', () => {
      const result = outputService.formatError({ request: {} });
      expect(result).toBe(
        'Network Error: Unable to connect to API. Please check your internet connection and API URL.'
      );
    });

    it('falls back to the error message for a plain Error', () => {
      const result = outputService.formatError(new Error('something broke'));
      expect(result).toBe('something broke');
    });

    it('falls back to a generic message for an unrecognized error shape', () => {
      const result = outputService.formatError({});
      expect(result).toBe('An unknown error occurred');
    });
  });
});
