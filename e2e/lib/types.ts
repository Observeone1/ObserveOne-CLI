/**
 * Minimal structural types for predicates over JSON.parse'd CLI output.
 * Use these in `.find()` / `.some()` callbacks instead of inlining `{ name?: string }`.
 */
export type ResourcePreview = {
  id?: number;
  name?: string;
  slug?: string;
  title?: string;
};
