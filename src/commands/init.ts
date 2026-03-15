import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { existsSync, writeFileSync } from 'fs';
import { IConfigService } from '../interfaces/config.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';

export function createInitCommand(
  configService: IConfigService,
  outputService: IOutputService
): Command {
  return new Command('init')
    .description('Initialize project configuration in the current directory')
    .action(async () => {
      try {
        const configPath = '.obs.config.json';
        if (existsSync(configPath)) {
          outputService.warning('Project configuration already exists in this directory.');

          const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
            {
              type: 'confirm',
              name: 'overwrite',
              message: 'Do you want to overwrite it?',
              default: false,
            },
          ]);

          if (!overwrite) {
            console.log(chalk.gray('Operations aborted.'));
            process.exit(0);
          }
        }

        console.log(chalk.bold('\n🚀 Setting up project configuration...'));

        const projectAnswers = await inquirer.prompt<{
          projectName: string;
          projectDescription: string;
        }>([
          {
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
            default: process.cwd().split(/[/\\]/).pop() || 'My Project',
            validate: (input: string) => (input.trim() ? true : 'Project name is required'),
          },
          {
            type: 'input',
            name: 'projectDescription',
            message: 'Project description:',
            default: 'AI-powered test automation project',
          },
        ]);

        const projectConfig = {
          project: {
            name: projectAnswers.projectName,
            description: projectAnswers.projectDescription,
          },
          defaultOptions: {
            timeout: 600000,
            retries: 3,
            verbose: false,
            pollIntervalMs: 2000,
            maxAttempts: 300,
          },
        };

        writeFileSync(configPath, JSON.stringify(projectConfig, null, 2));
        configService.setProjectConfig(projectConfig.project);
        configService.setDefaultOptions(projectConfig.defaultOptions);
        outputService.success('Project configuration created!');
        process.exit(0);
      } catch (error: unknown) {
        const err = error as Error;
        outputService.error(`Failed to initialize project: ${err.message}`);
        process.exit(1);
      }
    });
}
