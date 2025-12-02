import "dotenv/config"; // Load environment variables
import { readdirSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import chalk from "chalk";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

async function runTests(): Promise<void> {
  console.log(chalk.cyan.bold("\n🧪 Running E2E Tests\n"));

  const testsDir = join(process.cwd(), "e2e", "tests");
  const testFiles = readdirSync(testsDir).filter((f) => f.endsWith(".test.ts"));

  const results: TestResult[] = [];
  let totalTests = 0;
  let passedTests = 0;
  const startTime = Date.now();

  for (const file of testFiles) {
    console.log(chalk.gray(`\n ${file}\n`));

    const testPath = join(testsDir, file);
    const testModule = await import(pathToFileURL(testPath).href);

    // Find all exported test functions
    const testFunctions = Object.entries(testModule).filter(
      ([key]) => key.startsWith("test") && typeof testModule[key] === "function"
    );

    for (const [name, testFn] of testFunctions) {
      totalTests++;
      const start = Date.now();

      try {
        await (testFn as Function)();
        const duration = Date.now() - start;
        results.push({ name, passed: true, duration });
        passedTests++;
        console.log(chalk.green(`    ✓ ${name.replace(/([A-Z])/g, " $1").trim()} (${duration}ms)`));
      } catch (error: any) {
        const duration = Date.now() - start;
        results.push({
          name,
          passed: false,
          error: error.message,
          duration,
        });
        console.log(chalk.red(`    ✗ ${name.replace(/([A-Z])/g, " $1").trim()} (${duration}ms)`));
        if (error.message) {
          console.log(chalk.gray(`      ${error.message}`));
        }
      }
    }
  }

  const totalTime = Date.now() - startTime;

  // Summary
  console.log(chalk.bold("\n\n Summary\n"));
  console.log(chalk.gray("─".repeat(50)));

  if (results.some(r => !r.passed)) {
    console.log(chalk.red.bold("  ❌ Failed Tests"));
    console.log(chalk.gray("  ─".repeat(25)));
    const failedTests = results.filter(r => !r.passed);
    for (const result of failedTests) {
      console.log(chalk.red(`  ✗ ${result.name}`));
      console.log(chalk.gray(`    ${result.error}`));
    }
    console.log(chalk.gray("  ─".repeat(25)));
  }

  console.log(`  Total: ${totalTests}`);
  console.log(chalk.green(`  Passed: ${passedTests}`));
  console.log(chalk.red(`  Failed: ${totalTests - passedTests}`));
  console.log(chalk.blue(`  Time: ${totalTime}ms`));

  if (passedTests === totalTests) {
    console.log(chalk.green.bold("\n  ✅ All tests passed!\n"));
    process.exit(0);
  } else {
    console.log(chalk.red.bold("\n  ❌ Some tests failed\n"));
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error(chalk.red("Error running tests:"), error);
  process.exit(1);
});
