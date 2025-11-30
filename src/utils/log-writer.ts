import fs from "fs";
import path from "path";

export class LogWriter {
  private logPath: string;
  private stream: fs.WriteStream;

  constructor(taskId: string) {
    // Create logs directory in .obs1 folder
    const logsDir = path.join(process.cwd(), ".obs1", "logs");
    fs.mkdirSync(logsDir, { recursive: true });

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.logPath = path.join(logsDir, `execution-${taskId}-${timestamp}.log`);
    this.stream = fs.createWriteStream(this.logPath, { flags: "w" });

    // Write header
    this.writeLine("=".repeat(70));
    this.writeLine(`ObserveOne CLI - Execution Log`);
    this.writeLine(`Task ID: ${taskId}`);
    this.writeLine(`Started: ${new Date().toISOString()}`);
    this.writeLine("=".repeat(70));
    this.writeLine("");
  }

  writeStep(step: any): void {
    const timestamp = new Date().toISOString();
    this.writeLine(`[${timestamp}] Step ${step.step_number || "N/A"}`);
    this.writeLine("-".repeat(70));

    if (step.next_goal) {
      this.writeLine(`Goal: ${step.next_goal}`);
    }

    if (step.evaluation) {
      this.writeLine(`Evaluation: ${step.evaluation}`);
    }

    if (step.memory) {
      this.writeLine(`Memory: ${step.memory}`);
    }

    if (step.actions && step.actions.length > 0) {
      this.writeLine("Actions:");
      step.actions.forEach((action: any, index: number) => {
        const actionType = Object.keys(action)[0];
        const params = action[actionType];
        const paramStr = Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        this.writeLine(`  ${index + 1}. ${actionType} (${paramStr})`);
      });
    }

    if (step.result && step.result.length > 0) {
      this.writeLine("Results:");
      step.result.forEach((result: any, index: number) => {
        if (result.extracted_content) {
          this.writeLine(`  ${index + 1}. ${result.extracted_content}`);
        } else if (result.error) {
          this.writeLine(`  ${index + 1}. Error: ${result.error}`);
        } else {
          this.writeLine(`  ${index + 1}. Success: ${result.success}`);
        }
      });
    }

    this.writeLine("");
  }

  writeMessage(type: string, message: any): void {
    const timestamp = new Date().toISOString();
    this.writeLine(`[${timestamp}] ${type.toUpperCase()}`);
    this.writeLine(JSON.stringify(message, null, 2));
    this.writeLine("");
  }

  writeScreenshot(count: number): void {
    const timestamp = new Date().toISOString();
    this.writeLine(`[${timestamp}] Screenshot #${count} captured`);
  }

  writeComplete(status: string, message?: string): void {
    this.writeLine("=".repeat(70));
    this.writeLine(`Execution completed: ${status.toUpperCase()}`);
    if (message) {
      this.writeLine(`Message: ${message}`);
    }
    this.writeLine(`Completed: ${new Date().toISOString()}`);
    this.writeLine("=".repeat(70));
  }

  private writeLine(text: string): void {
    this.stream.write(text + "\n");
  }

  close(): void {
    this.stream.end();
  }

  getPath(): string {
    return this.logPath;
  }
}
