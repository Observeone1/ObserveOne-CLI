import { Command } from 'commander';
import chalk from 'chalk';
import { IOutputService } from '../../interfaces/output.interface.js';
import { reportActionError } from '../id-action-command.js';

interface PlannedFileCommandOptions<T extends object> {
  name: string;
  description: string;
  optionDescription: string;
  successMessage: (plannedFile: string) => string;
  failureMessage: string;
  outputService: IOutputService;
  apply: (suiteId: string, plannedFile: string) => Promise<T>;
}

/**
 * `dismiss-planned` and `restore-planned` are the same command with a different
 * api call and wording: one suite id, one required `--planned-file`, then the
 * result echoed back with the suite id and file path attached.
 */
export function createPlannedFileCommand<T extends object>(
  options: PlannedFileCommandOptions<T>
): Command {
  return new Command(options.name)
    .description(options.description)
    .argument('<suite-id>', 'Suite ID')
    .requiredOption('--planned-file <file>', options.optionDescription)
    .action(async (suiteId: string, commandOptions: { plannedFile: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const result = await options.apply(suiteId, commandOptions.plannedFile);
        if (isJson) {
          options.outputService.formatJsonOutput({
            ...result,
            suiteId,
            plannedFile: commandOptions.plannedFile,
          });
          return;
        }
        console.log(chalk.green(options.successMessage(commandOptions.plannedFile)));
      } catch (err: unknown) {
        reportActionError(err, {
          isJson,
          failureMessage: options.failureMessage,
          outputService: options.outputService,
          errorPrefix: '❌ ',
        });
      }
    });
}
