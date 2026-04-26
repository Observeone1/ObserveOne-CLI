import inquirer from 'inquirer';

export async function requireConfirmation(
  message: string,
  options: {
    yes?: boolean | undefined;
    isJson?: boolean | undefined;
    outputError: (msg: string) => void;
  }
): Promise<boolean> {
  if (options.yes) return true;

  if (!process.stdin.isTTY || options.isJson) {
    options.outputError(
      'Confirmation required. Re-run with --yes (or -y) for non-interactive mode.'
    );
    process.exit(1);
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message,
      default: false,
    },
  ]);
  return confirm as boolean;
}

export function requireTTY(outputError: (msg: string) => void): void {
  if (!process.stdin.isTTY) {
    outputError('Interactive prompt cannot run in non-TTY mode. Pass all required flags instead.');
    process.exit(1);
  }
}
