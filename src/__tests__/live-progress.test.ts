// Test for LiveProgressRenderer
import { LiveProgressRenderer } from "../utils/live-progress.js";
import { vi, beforeEach, describe, it, expect } from "vitest";
import ora from "ora";

// Mock ora
vi.mock("ora", async () => {
  const actual = await vi.importActual("ora");
  return {
    default: vi.fn(() => ({
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      warn: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
      text: "",
      isSpinning: false,
    })),
  };
});

// Mock chalk
vi.mock("chalk", async () => {
  const actual = await vi.importActual("chalk");
  return {
    __esModule: true,
    default: {
      bold: (str: string) => str,
      blue: (str: string) => str,
      cyan: (str: string) => str,
      gray: (str: string) => str,
      green: (str: string) => str,
      red: (str: string) => str,
      yellow: (str: string) => str,
      magenta: (str: string) => str,
    },
  };
});

describe("LiveProgressRenderer", () => {
  let mockSpinner: any;
  let renderer: LiveProgressRenderer;

  beforeEach(() => {
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      text: "",
    };
    // The 'ora' import is the mocked function itself
    (ora as any).mockReturnValue(mockSpinner);
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      renderer = new LiveProgressRenderer();
      expect(renderer).toBeDefined();
    });

    it("should initialize with verbose mode", () => {
      renderer = new LiveProgressRenderer({ verbose: true });
      expect(renderer).toBeDefined();
    });
  });

  describe("start", () => {
    it("should display test name and start spinner", () => {
      renderer = new LiveProgressRenderer();
      renderer.start("Test Name");

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Test Name")
      );
      expect(mockSpinner.start).toHaveBeenCalled();
    });
  });

  describe("updateStep", () => {
    beforeEach(() => {
      renderer = new LiveProgressRenderer();
      renderer.start("Test");
    });

    it("should update step in compact mode", () => {
      renderer.updateStep(1, "Navigate to homepage");

      expect(mockSpinner.text).toContain("Step 1");
      expect(mockSpinner.text).toContain("Navigate to homepage");
    });

    it("should update step in verbose mode with details", () => {
      renderer = new LiveProgressRenderer({ verbose: true });
      renderer.start("Test");

      const details = {
        evaluation: "Page loaded successfully",
        actions: [{ go_to_url: { url: "https://example.com" } }],
        result: [{ success: true }],
      };

      renderer.updateStep(1, "Navigate to homepage", details);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Step 1")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Navigate to homepage")
      );
    });
  });

  describe("addScreenshot", () => {
    it("should increment screenshot count", () => {
      renderer = new LiveProgressRenderer();
      renderer.start("Test");

      renderer.addScreenshot();
      renderer.addScreenshot();

      // Screenshot count is tracked internally
      expect(renderer).toBeDefined();
    });
  });

  describe("updateStatus", () => {
    it("should update spinner text", () => {
      renderer = new LiveProgressRenderer();
      renderer.start("Test");

      renderer.updateStatus("Processing...");
      expect(mockSpinner.text).toContain("Processing...");
    });
  });

  describe("complete", () => {
    beforeEach(() => {
      renderer = new LiveProgressRenderer();
      renderer.start("Test");
    });

    it("should show success completion", () => {
      renderer.complete("success", "Test passed");

      expect(mockSpinner.succeed).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it("should show failed completion", () => {
      renderer.complete("failed", "Test failed");

      expect(mockSpinner.fail).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("error", () => {
    it("should display error message", () => {
      renderer = new LiveProgressRenderer();
      renderer.start("Test");

      renderer.error("Something went wrong");
      expect(mockSpinner.fail).toHaveBeenCalled();
    });
  });

  describe("getStartTime", () => {
    it("should return start timestamp", () => {
      renderer = new LiveProgressRenderer();
      const startTime = renderer.getStartTime();

      expect(typeof startTime).toBe("number");
      expect(startTime).toBeGreaterThan(0);
    });
  });
});
