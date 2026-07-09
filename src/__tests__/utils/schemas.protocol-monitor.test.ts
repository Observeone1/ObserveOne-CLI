import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveSchema, buildJsonSchema } from '../../utils/schemas.js';
import { buildDefaultCreatePrompts } from '../../utils/schema-prompts.js';

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() } }));
import inquirer from 'inquirer';
const promptMock = inquirer.prompt as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  promptMock.mockReset();
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
});

describe('protocol-monitor schemas', () => {
  it('resolves each monitor schema by full key and short alias', () => {
    expect(resolveSchema('ssl-monitor')).toBe(resolveSchema('ssl'));
    expect(resolveSchema('tcp-monitor')).toBe(resolveSchema('tcp'));
    expect(resolveSchema('udp-monitor')).toBe(resolveSchema('udp'));
    expect(resolveSchema('db-monitor')).toBe(resolveSchema('db'));
  });

  it('declares the required fields for each type', () => {
    expect(resolveSchema('ssl-monitor')!.required).toEqual(['name', 'hostname']);
    expect(resolveSchema('tcp-monitor')!.required).toEqual(['name', 'host', 'port']);
    expect(resolveSchema('udp-monitor')!.required).toEqual(['name', 'host', 'port']);
    expect(resolveSchema('db-monitor')!.required).toEqual(['name', 'host', 'port', 'protocol']);
  });

  it('builds a JSON schema exposing the db protocol enum via template', () => {
    const json = buildJsonSchema('db-monitor') as {
      required: string[];
      properties: Record<string, { type: string }>;
    };
    expect(json.required).toContain('protocol');
    expect(json.properties.protocol!.type).toBe('string');
    expect(json.properties.tls!.type).toBe('boolean');
  });
});

describe('protocol-monitor create payloads', () => {
  it('applies the SSL port and warn_days defaults when flags are omitted', async () => {
    const generator = buildDefaultCreatePrompts(resolveSchema('ssl-monitor')!);
    const payload = (await generator({
      name: 'cert',
      hostname: 'example.com',
    })) as Record<string, unknown>;

    expect(promptMock).not.toHaveBeenCalled();
    expect(payload).toEqual(
      expect.objectContaining({
        name: 'cert',
        hostname: 'example.com',
        port: 443,
        warn_days: 30,
        timeout_ms: 30000,
        alert_on_failure: true,
        cron_expression: '0 0 * * *',
      })
    );
  });

  it('coerces db port to an int and lowercases the protocol', async () => {
    const generator = buildDefaultCreatePrompts(resolveSchema('db-monitor')!);
    const payload = (await generator({
      name: 'pg',
      host: 'db.example.com',
      port: '5432',
      protocol: 'POSTGRES',
    })) as Record<string, unknown>;

    expect(payload.port).toBe(5432);
    expect(payload.protocol).toBe('postgres');
    expect(payload.tls).toBe(false);
  });

  it('rejects an invalid db protocol choice', async () => {
    const generator = buildDefaultCreatePrompts(resolveSchema('db-monitor')!);
    await expect(
      generator({ name: 'x', host: 'h', port: '1', protocol: 'mongodb' })
    ).rejects.toThrow(/protocol/i);
  });

  it('sets udp expect_response false by default and passes payload_hex through', async () => {
    const generator = buildDefaultCreatePrompts(resolveSchema('udp-monitor')!);
    const payload = (await generator({
      name: 'dns',
      host: '1.1.1.1',
      port: '53',
      payloadHex: 'deadbeef',
    })) as Record<string, unknown>;

    expect(payload.expect_response).toBe(false);
    expect(payload.payload_hex).toBe('deadbeef');
    expect(payload.port).toBe(53);
  });
});
