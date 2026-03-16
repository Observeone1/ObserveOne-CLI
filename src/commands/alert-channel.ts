import { Command } from 'commander';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { createResourceCommand } from './resource-command.factory.js';
import { AlertChannel, AlertChannelConfig, AlertChannelType } from '../types/index.js';

const channelTypes: AlertChannelType[] = [
  'email',
  'slack',
  'discord',
  'teams',
  'telegram',
  'sms',
  'webhook',
];

function normalizeChannelType(type?: string): AlertChannelType | undefined {
  if (!type) return undefined;
  const normalized = type.toLowerCase() as AlertChannelType;
  return channelTypes.includes(normalized) ? normalized : undefined;
}

async function buildConfigFromOptions(
  type: AlertChannelType,
  options: Record<string, unknown>,
  existingConfig?: AlertChannelConfig
): Promise<AlertChannelConfig> {
  const config: AlertChannelConfig = { ...(existingConfig || {}) };

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
  return createResourceCommand<AlertChannel>(configService, apiClient, outputService, {
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
        .option('-t, --type <type>', 'Channel type (email, slack, discord, teams, telegram, sms, webhook)')
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
        .option('-t, --type <type>', 'Channel type (email, slack, discord, teams, telegram, sms, webhook)')
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
    createPrompts: async (options) => {
      let name = options.name as string | undefined;
      let type = normalizeChannelType(options.type as string | undefined);

      if (!name || !type) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Channel name:',
            when: !name,
            validate: (val: string) => (val.trim() ? true : 'Name is required'),
          },
          {
            type: 'list',
            name: 'type',
            message: 'Channel type:',
            when: !type,
            choices: channelTypes,
          },
        ]);
        name = name || (answers.name as string);
        type = type || (answers.type as AlertChannelType);
      }

      if (!type) {
        throw new Error('Channel type is required.');
      }

      const config = await buildConfigFromOptions(type, options);
      const isDefault = options.default === true;

      return {
        name,
        type,
        config,
        is_default: isDefault,
      };
    },
    updatePrompts: async (_id, options, existing) => {
      const hasChanges =
        options.name ||
        options.type ||
        options.email ||
        options.webhookUrl ||
        options.botToken ||
        options.chatId ||
        options.accountSid ||
        options.authToken ||
        options.fromNumber ||
        options.phoneNumber ||
        options.default !== undefined;

      if (!hasChanges) {
        outputService.error('Please provide at least one field to update.');
        process.exit(1);
      }

      const name = (options.name as string | undefined) || existing.name;
      const type = normalizeChannelType(options.type as string | undefined) || existing.type;

      const config = await buildConfigFromOptions(type, options, existing.config);
      const isDefault = options.default === true ? true : existing.is_default;

      return {
        name,
        type,
        config,
        is_default: isDefault,
      };
    },
  });
}
