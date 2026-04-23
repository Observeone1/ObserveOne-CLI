import { ApiCheck, Heartbeat, Test, UrlMonitor } from '../types/index.js';

export interface ApplyConfig {
  monitors?: Partial<UrlMonitor>[] | undefined;
  api_checks?: Partial<ApiCheck>[] | undefined;
  heartbeats?: Partial<Heartbeat>[] | undefined;
  ai_checks?: Partial<Test>[] | undefined;
}

type ApplyConfigKey = keyof ApplyConfig;

const singularResourceKeys: Record<string, ApplyConfigKey> = {
  monitor: 'monitors',
  'url-monitor': 'monitors',
  url_monitor: 'monitors',
  check: 'api_checks',
  'api-check': 'api_checks',
  api_check: 'api_checks',
  heartbeat: 'heartbeats',
  'ai-check': 'ai_checks',
  ai_check: 'ai_checks',
  'browser-check': 'ai_checks',
  browser_check: 'ai_checks',
};

const pluralResourceKeys: ApplyConfigKey[] = ['monitors', 'api_checks', 'heartbeats', 'ai_checks'];

export function normalizeApplyConfig(raw: unknown): ApplyConfig {
  if (!isRecord(raw)) {
    throw new Error('Apply file must contain a JSON object.');
  }

  if (hasPluralConfig(raw)) {
    return normalizePluralConfig(raw);
  }

  const wrappedEntry = getWrappedResource(raw);
  if (wrappedEntry) {
    return { [wrappedEntry.key]: [wrappedEntry.resource] };
  }

  const inferred = inferBareResource(raw);
  if (inferred) {
    return { [inferred.key]: [inferred.resource] };
  }

  throw new Error(
    'Unsupported apply file shape. Use obs.json, {"monitor": {...}}, {"type": "monitor", ...}, or a bare monitor/check/heartbeat object.'
  );
}

function hasPluralConfig(value: Record<string, unknown>): boolean {
  return pluralResourceKeys.some((key) => key in value);
}

function normalizePluralConfig(value: Record<string, unknown>): ApplyConfig {
  const config: ApplyConfig = {};

  for (const key of pluralResourceKeys) {
    const entry = value[key];
    if (entry === undefined) continue;
    if (!Array.isArray(entry)) {
      throw new Error(`'${key}' must be an array in apply config files.`);
    }
    config[key] = entry;
  }

  return config;
}

function getWrappedResource(
  value: Record<string, unknown>
): { key: ApplyConfigKey; resource: Record<string, unknown> } | null {
  const entries = Object.entries(value).filter(([key]) => key !== 'type' && key !== 'resource');
  if (entries.length !== 1) return null;

  const [resourceKey, resourceValue] = entries[0]!;
  const normalizedKey = singularResourceKeys[resourceKey];
  if (!normalizedKey || !isRecord(resourceValue)) return null;

  return { key: normalizedKey, resource: resourceValue };
}

function inferBareResource(
  value: Record<string, unknown>
): { key: ApplyConfigKey; resource: Record<string, unknown> } | null {
  const resourceType = getDeclaredResourceType(value.type ?? value.resource);
  const resource = stripMetadataKeys(value);

  if (resourceType) {
    return { key: resourceType, resource };
  }

  if ('prompt' in resource) return { key: 'ai_checks', resource };
  if ('period' in resource || 'grace_period' in resource || 'ping_key' in resource) {
    return { key: 'heartbeats', resource };
  }
  if ('url' in resource && 'method' in resource) return { key: 'api_checks', resource };
  if ('url' in resource) return { key: 'monitors', resource };

  return null;
}

function getDeclaredResourceType(value: unknown): ApplyConfigKey | null {
  if (typeof value !== 'string') return null;
  return singularResourceKeys[value] || null;
}

function stripMetadataKeys(value: Record<string, unknown>): Record<string, unknown> {
  const { type: _type, resource: _resource, ...rest } = value;
  return rest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
