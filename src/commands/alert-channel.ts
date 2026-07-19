import { Command } from 'commander';
import chalk from 'chalk';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { ApiClient } from '../services/api-client.service.js';
import { createResourceCommand } from './resource-command.factory.js';
import { AlertChannel, AlertChannelConfig, AlertChannelType } from '../types/index.js';
import { schemas } from '../utils/schemas.js';
import { buildDefaultCreatePrompts, buildDefaultUpdatePrompts } from '../utils/schema-prompts.js';

async function buildConfigFromOptions(
  type: AlertChannelType,
  options: Record<string, unknown>,
  existingConfig?: AlertChannelConfig
): Promise<AlertChannelConfig> {
  const config: AlertChannelConfig = Object.assign({}, existingConfig);

  const email = (options.email as string | undefined) ?? existingConfig?.email;
  const webhookUrl =
    (options.webhookUrl as string | undefined) ??
    (options.webhook_url as string | undefined) ??
    existingConfig?.webhook_url;
  const botToken = (options.botToken as string | undefined) ?? existingConfig?.bot_token;
  const chatId = (options.chatId as string | undefined) ?? existingConfig?.chat_id;
  const accountSid = (options.accountSid as string | undefined) ?? existingConfig?.account_sid;
  const authToken = (options.authToken as string | undefined) ?? existingConfig?.auth_token;
  const fromNumber = (options.fromNumber as string | undefined) ?? existingConfig?.from_number;
  const phoneNumber = (options.phoneNumber as string | undefined) ?? existingConfig?.phone_number;

  if (type === 'email') {
    config.email = email;
  } else if (type === 'telegram') {
    config.bot_token = botToken;
    config.chat_id = chatId;
  } else if (type === 'sms') {
    config.account_sid = accountSid;
    config.auth_token = authToken;
    config.from_number = fromNumber;
    config.phone_number = phoneNumber;
  } else {
    config.webhook_url = webhookUrl;
  }

  const missing =
    (type === 'email' && !config.email) ||
    (type === 'telegram' && (!config.bot_token || !config.chat_id)) ||
    (type === 'sms' &&
      (!config.account_sid || !config.auth_token || !config.from_number || !config.phone_number)) ||
    (['slack', 'discord', 'teams', 'webhook'].includes(type) && !config.webhook_url);

  if (missing) {
    throw new Error(`Missing required configuration for ${type} channel.`);
  }

  return config;
}

export function createAlertChannelCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = createResourceCommand<AlertChannel>(configService, apiClient, outputService, {
    resourceName: 'alert-channel',
    pluralName: 'alert channels',
    description: 'Manage alert channels',
    apiMethods: {
      list: () => apiClient.getAlertChannels(),
      get: (id) => apiClient.getAlertChannel(id),
      create: (data) => apiClient.createAlertChannel(data),
      update: (id, data) => apiClient.updateAlertChannel(id, data),
      delete: (id) => apiClient.deleteAlertChannel(id),
    },
    formatters: {
      list: (items, verbose) => outputService.formatAlertChannelList(items, verbose),
    },
    createCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Channel name')
        .option(
          '-t, --type <type>',
          'Channel type (email, slack, discord, teams, telegram, sms, webhook)'
        )
        .option('--email <email>', 'Email address for email alerts')
        .option('--webhook-url <url>', 'Webhook URL for slack/discord/teams/webhook')
        .option('--bot-token <token>', 'Telegram bot token')
        .option('--chat-id <id>', 'Telegram chat ID')
        .option('--account-sid <sid>', 'SMS account SID')
        .option('--auth-token <token>', 'SMS auth token')
        .option('--from-number <number>', 'SMS from number')
        .option('--phone-number <number>', 'SMS to number')
        .option('--default', 'Set this channel as default');
    },
    updateCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Channel name')
        .option(
          '-t, --type <type>',
          'Channel type (email, slack, discord, teams, telegram, sms, webhook)'
        )
        .option('--email <email>', 'Email address for email alerts')
        .option('--webhook-url <url>', 'Webhook URL for slack/discord/teams/webhook')
        .option('--bot-token <token>', 'Telegram bot token')
        .option('--chat-id <id>', 'Telegram chat ID')
        .option('--account-sid <sid>', 'SMS account SID')
        .option('--auth-token <token>', 'SMS auth token')
        .option('--from-number <number>', 'SMS from number')
        .option('--phone-number <number>', 'SMS to number')
        .option('--default', 'Set this channel as default');
    },
    // Schema drives name + type + is_default; the `config` field stays in a
    // thin override because its shape is type-dependent (email vs telegram vs
    // sms vs webhook config keys all differ).
    createPrompts: async (options) => {
      const base = await buildDefaultCreatePrompts<AlertChannel>(schemas['alert-channel']!)(
        options
      );
      const type = base.type as AlertChannelType;
      const config = await buildConfigFromOptions(type, options);
      return { ...base, config };
    },
    updatePrompts: async (id, options, existing) => {
      const base = await buildDefaultUpdatePrompts<AlertChannel>(
        schemas['alert-channel']!,
        outputService
      )(id, options, existing);
      const type = (base.type as AlertChannelType) ?? existing.type;
      const config = await buildConfigFromOptions(type, options, existing.config);
      return { ...base, type, config };
    },
  });

  cmd
    .command('test <id>')
    .description('Send a test notification through an alert channel')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const channelId = id.trim();
        if (!channelId) throw new Error('Invalid channel ID');

        const result = await (apiClient as ApiClient).testAlertChannel(channelId);

        if (isJson) {
          outputService.formatJsonOutput({ success: result.success, message: result.message });
          return;
        }

        console.log(chalk.bold(`\n ${result.message}\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to test alert channel';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n ${msg}\n`));
        }
        process.exit(1);
      }
    });

  return cmd;
}
