import chalk from 'chalk';
import { Suite, SuiteExecution, SuiteTestResult } from '../../types/index.js';

export function suiteStatusColor(status: string): string {
  switch (status) {
    case 'scheduled':
      return chalk.green(status);
    case 'failed':
      return chalk.red(status);
    case 'pending':
    case 'generating':
      return chalk.yellow(status);
    case 'crawling':
    case 'planning':
    case 'healing':
      return chalk.blue(status);
    default:
      return chalk.gray(status);
  }
}

export function formatCron(expr: string, active: boolean): string {
  if (!active || !expr) return chalk.gray('manual');
  if (expr === '0 */6 * * *') return chalk.gray('every 6h');
  if (expr === '0 */12 * * *') return chalk.gray('every 12h');
  if (expr === '0 0 * * *') return chalk.gray('daily');
  if (expr === '0 0 * * 0') return chalk.gray('weekly');
  return chalk.gray(expr);
}

export function printSuiteList(suites: Suite[]): void {
  if (suites.length === 0) {
    console.log(chalk.gray('\n No suites yet. Run: obs suite generate <url>\n'));
    return;
  }
  console.log(chalk.bold(`\n Suites (${suites.length})`));
  console.log(chalk.gray('─'.repeat(60)));
  suites.forEach((suite, i) => {
    const tests = chalk.gray(`${suite.test_count} tests`);
    const schedule = formatCron(suite.cron_expression, suite.schedule_active);
    console.log(
      ` ${chalk.bold(`${i + 1}.`)} ${chalk.bold(suite.suite_name.padEnd(30))} ${suiteStatusColor(suite.status).padEnd(20)} ${tests.padEnd(10)} ${schedule}`
    );
    console.log(chalk.gray(`    ${suite.target_url}  id: ${suite.id}`));
    console.log('');
  });
}

export function printSuiteDetail(suite: Suite): void {
  console.log(chalk.bold(`\n ${suite.suite_name}`));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(` Status:    ${suiteStatusColor(suite.status)}`);
  console.log(` URL:       ${suite.target_url}`);
  console.log(` ID:        ${suite.id}`);
  console.log(` Tests:     ${suite.test_count} / ${suite.max_tests} max`);
  console.log(` Schedule:  ${formatCron(suite.cron_expression, suite.schedule_active)}`);
  if (suite.secret_keys.length > 0) {
    console.log(` Variables: ${suite.secret_keys.map((k) => chalk.yellow(k)).join(', ')}`);
  }
  if (suite.error_message) {
    console.log(` Error:     ${chalk.red(suite.error_message)}`);
  }
  if (suite.generated_tests.length > 0) {
    console.log(chalk.bold('\n Generated tests:'));
    suite.generated_tests.forEach((t, i) => {
      console.log(chalk.gray(`   ${i + 1}. ${t.name}  (id: ${t.id})`));
    });
  }
  console.log('');
}

export function printExecutionResults(execution: SuiteExecution): void {
  const ok = execution.status === 'COMPLETED';
  const icon = ok ? chalk.green('✔') : chalk.red('✘');
  const dur = execution.duration_ms ? ` (${(execution.duration_ms / 1000).toFixed(1)}s)` : '';
  console.log(`\n ${icon}  Suite run ${execution.status.toLowerCase()}${dur}\n`);

  for (const r of execution.test_results) {
    printTestRow(r);
  }

  const total = execution.total || execution.test_results.length;
  const passed =
    execution.passed ?? execution.test_results.filter((r) => r.status === 'PASSED').length;
  const failed =
    execution.failed ?? execution.test_results.filter((r) => r.status === 'FAILED').length;

  console.log('');
  const summary =
    failed > 0
      ? chalk.bold(` Results: ${passed}/${total} passed`) + chalk.red(`  •  ${failed} failed`)
      : chalk.bold(` Results: ${passed}/${total} passed`) + chalk.green('  •  all passed');
  console.log(summary);
  console.log(chalk.gray(` Execution ID: ${execution.id}`));
  console.log('');
}

function printTestRow(r: SuiteTestResult): void {
  const icon =
    r.status === 'PASSED'
      ? chalk.green('PASSED ')
      : r.status === 'FAILED'
        ? chalk.red('FAILED ')
        : r.status === 'SKIPPED'
          ? chalk.yellow('SKIPPED')
          : chalk.gray('PENDING');
  const dur = r.duration_ms != null ? chalk.gray(`  ${(r.duration_ms / 1000).toFixed(1)}s`) : '';
  const err = r.error ? chalk.red(`  → ${r.error}`) : '';
  console.log(` ${icon}   ${r.name.padEnd(40)}${dur}${err}`);
}
