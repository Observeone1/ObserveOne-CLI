import { Suite } from '../types/index.js';

// Ported from the dashboard's plan-scenario parser
// (ObserveOne-frontend src/pages/playwright-autopilot/tests/planScenarios.ts)
// so the CLI's staleness/regenerate logic matches the web UI exactly. Keep
// `planFileKey` byte-for-byte identical to that source and to the backend's
// `normalizePlannedFileKey()` — `stale_planned_files` / `dismissed_planned_files`
// are keyed by it, so any drift silently breaks matching.

export interface PlanScenario {
  /** Heading text, without the leading #s. */
  title: string;
  headingLevel: number;
  /** Planned file name, e.g. "login.spec.ts" (no tests/ prefix). */
  file: string;
}

const FILE_LINE_RE =
  /^\s*\*\*File:\*\*\s*`?(?:tests\/)?([^`\s]+?\.(?:spec|test)\.ts)`?\s*(?:_\(dismissed\)_\s*)?$/;

// A single `\s` (not `\s+`) between the hashes and the title: with `\s+`
// directly followed by `(.*)`, both quantifiers can match the same run of
// whitespace, which SonarQube flags as a quadratic-backtracking hotspot
// (typescript:S5852). One fixed-width separator plus the existing
// `.trim()` on the captured title produces an identical result for any
// number of spaces after the `#`s, without the overlapping quantifiers.
const HEADING_RE = /^(#{1,6})\s(.*)$/;

/**
 * Normalized key for a planned file — must match the backend's
 * normalizePlannedFileKey(): basename minus .spec/.test.ts, lowercased.
 * `stale_planned_files` and `dismissed_planned_files` hold these keys.
 */
export function planFileKey(file: string): string {
  return file
    .replace(/^.*\//, '')
    .replace(/\.(spec|test)\.ts$/, '')
    .toLowerCase();
}

/** Parse the `**File:** \`tests/foo.spec.ts\`` scenario headings out of a plan. */
export function parsePlanScenarios(markdown: string): PlanScenario[] {
  const lines = markdown.split('\n');

  interface RawSection {
    title: string;
    level: number;
    file: string | null;
  }
  const sections: RawSection[] = [];
  let current: RawSection | null = null;

  for (const line of lines) {
    const hm = HEADING_RE.exec(line);
    if (hm) {
      current = { title: hm[2]!.trim(), level: hm[1]!.length, file: null };
      sections.push(current);
    } else if (current && !current.file) {
      const fm = FILE_LINE_RE.exec(line);
      if (fm) current.file = fm[1]!.trim();
    }
  }

  // Mirror the section-group anchoring: the scenario level is the deepest
  // heading level that carries File markers.
  const levelsWithFiles = sections.filter((s) => s.file).map((s) => s.level);
  const scenarioLevel = levelsWithFiles.length > 0 ? Math.max(...levelsWithFiles) : -1;

  return sections
    .filter((s): s is RawSection & { file: string } => !!s.file && s.level === scenarioLevel)
    .map((s) => ({ title: s.title, headingLevel: s.level, file: s.file }));
}

type GeneratedTest = Suite['generated_tests'][number];

/**
 * Match a planned file to a generated test. Generated test names are the
 * plan file basename with dashes/underscores as spaces (or already dashed).
 */
export function findGeneratedTest(file: string, tests: GeneratedTest[]): GeneratedTest | undefined {
  const base = planFileKey(file);
  return tests.find((t) => {
    const name = t.name.toLowerCase();
    return name.replaceAll(/\s+/g, '-') === base || name === base.replaceAll(/[-_]/g, ' ');
  });
}

export type PlanFileState = 'generated' | 'stale' | 'dismissed' | 'missing';

export interface PlanFileStatus {
  file: string;
  key: string;
  state: PlanFileState;
}

/**
 * Classify every planned file in the suite's plan against its generated
 * tests, dismissed keys, and stale keys — the same derivation the dashboard's
 * useSuiteGeneration hook does for the tests-tab rail (fileStates).
 */
export function classifyPlannedFiles(suite: Suite): PlanFileStatus[] {
  const scenarios = parsePlanScenarios(suite.plan_markdown ?? '');
  const generatedTests = suite.generated_tests ?? [];
  const dismissedSet = new Set(suite.dismissed_planned_files ?? []);
  const staleSet = new Set(suite.stale_planned_files ?? []);

  return scenarios.map((s) => {
    const key = planFileKey(s.file);
    const test = findGeneratedTest(s.file, generatedTests);
    let state: PlanFileState;
    if (dismissedSet.has(key)) state = 'dismissed';
    else if (test && staleSet.has(key)) state = 'stale';
    else if (test) state = 'generated';
    else state = 'missing';
    return { file: s.file, key, state };
  });
}

export interface RegenerateTargets {
  /** Files this run will regenerate, in plan order. */
  targets: PlanFileStatus[];
  /** True when the targets came from the stale/missing fallback to "all buildable". */
  usedAllFallback: boolean;
}

/**
 * Compute which planned files a regenerate run should target.
 *
 * Mirrors the dashboard's regenTargets derivation (stale-or-missing files;
 * fall back to every non-dismissed file when nothing is stale/missing) —
 * except the CLI never takes the fallback silently. A bulk regenerate of
 * every file is expensive (AI generation cost) and surprising as a default,
 * so the fallback only activates when the caller passes `allowAllFallback`
 * (the `--all` flag) — this is an intentional deviation from the web UI,
 * called out in the PR description.
 */
export function computeRegenerateTargets(
  suite: Suite,
  allowAllFallback: boolean
): RegenerateTargets {
  const statuses = classifyPlannedFiles(suite);
  const staleOrMissing = statuses.filter((s) => s.state === 'stale' || s.state === 'missing');
  if (staleOrMissing.length > 0) {
    return { targets: staleOrMissing, usedAllFallback: false };
  }
  if (!allowAllFallback) {
    return { targets: [], usedAllFallback: false };
  }
  const buildable = statuses.filter((s) => s.state !== 'dismissed');
  return { targets: buildable, usedAllFallback: true };
}
