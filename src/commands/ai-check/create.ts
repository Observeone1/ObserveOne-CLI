import { Command } from 'commander';
import inquirer from 'inquirer';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createAiCheckCreateCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return new Command('create')
    .description('Create a new AI browser check')
    .option('-n, --name <name>', 'Test name')
    .option('-u, --url <url>', 'URL to test')
    .option('-p, --prompt <prompt>', 'Test prompt')
    .option('-j, --json', 'Output in JSON format')
    .action(async (options: Record<string, unknown>) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json === true) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        let name = options.name as string | undefined;
        let url = options.url as string | undefined;
        let prompt = options.prompt as string | undefined;

        if (!name || !url || !prompt) {
          const answers = await inquirer.prompt<{ name: string; url: string; prompt: string }>([
            {
              type: 'input',
              name: 'name',
              message: 'Check name:',
              when: !name,
              validate: (val: string) => (val.trim() ? true : 'Name is required'),
            },
            {
              type: 'input',
              name: 'url',
              message: 'URL to test:',
              when: !url,
              validate: (val: string) => {
                try {
                  new URL(val);
                  return true;
                } catch {
                  return 'Invalid URL';
                }
              },
            },
            {
              type: 'input',
              name: 'prompt',
              message: 'What should the AI check? (prompt):',
              when: !prompt,
              validate: (val: string) => (val.trim() ? true : 'Prompt is required'),
            },
          ]);
          name = name || answers.name;
          url = url || answers.url;
          prompt = prompt || answers.prompt;
        }

        outputService.progress('Creating AI browser check...');
        const newTest = await apiClient.createTest({
          name: name!,
          url: url!,
          prompt: prompt!,
          description: 'Created via CLI',
        });

        if (process.env.OBS_JSON_OUTPUT === 'true') {
          outputService.formatJsonOutput(newTest);
        } else {
          outputService.success(`AI browser check "${name}" created! (ID: ${newTest.id})`);
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });
}
