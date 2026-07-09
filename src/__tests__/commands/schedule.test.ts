import { describe, it, expect } from 'vitest';
import { createScheduleCommand } from '../../commands/schedule.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

const stubConfig = {} as IConfigService;
const stubApi = {} as IApiClient;
const stubOutput = {} as IOutputService;

describe('schedule command', () => {
  const cmd = createScheduleCommand(stubConfig, stubApi, stubOutput);

  it('registers name and sched alias', () => {
    expect(cmd.name()).toBe('schedule');
    expect(cmd.aliases()).toContain('sched');
  });

  it('exposes the full lifecycle + all-scope + bulk subcommands', () => {
    const subs = cmd.commands.map((c) => c.name());
    expect(subs).toEqual(
      expect.arrayContaining([
        'list',
        'get',
        'create',
        'update',
        'delete',
        'stop',
        'resume',
        'stop-all',
        'resume-all',
        'bulk',
      ])
    );
  });

  it('bulk takes an <action> arg and --id/--stdin options', () => {
    const bulk = cmd.commands.find((c) => c.name() === 'bulk')!;
    const longs = bulk.options.map((o) => o.long);
    expect(longs).toContain('--id');
    expect(longs).toContain('--stdin');
    // <action> positional
    expect(bulk.registeredArguments.map((a) => a.name())).toContain('action');
  });

  it('create requires --test-id and --interval', () => {
    const create = cmd.commands.find((c) => c.name() === 'create')!;
    const required = create.options.filter((o) => o.mandatory).map((o) => o.long);
    expect(required).toEqual(expect.arrayContaining(['--test-id', '--interval']));
  });
});
