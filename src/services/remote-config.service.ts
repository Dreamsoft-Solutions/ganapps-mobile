import remoteConfig from '@react-native-firebase/remote-config';

interface FeatureFlagStore {
  [key: string]: boolean | string | number;
}

const DEFAULT_CONFIG = require('../../config/feature-flags/default.json');
const DEFAULT_REMOTE_CONFIG_PARAMETER = 'mobile_default';

function isFeatureFlagValue(value: unknown): value is FeatureFlagStore[string] {
  return typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number';
}

function parseFeatureFlagStore(value: string): FeatureFlagStore {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Remote Config feature flag parameter must be a JSON object');
  }

  const flags: FeatureFlagStore = {};
  for (const [key, rawValue] of Object.entries(parsed)) {
    if (!isFeatureFlagValue(rawValue)) {
      throw new Error(`Remote Config feature flag "${key}" must be a string, boolean, or number`);
    }
    flags[key] = rawValue;
  }
  return flags;
}

class RemoteConfigService {
  private defaults: FeatureFlagStore = {};
  private remoteValues: FeatureFlagStore = {};
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.loadDefaults();
  }

  private loadDefaults(): void {
    if (DEFAULT_CONFIG.features) {
      for (const [key, raw] of Object.entries(DEFAULT_CONFIG.features)) {
        const value = raw as Record<string, unknown>;
        if (typeof value === 'object' && value !== null && 'enabled' in value) {
          this.defaults[key] = (value as { enabled: boolean }).enabled as FeatureFlagStore[string];
        } else {
          this.defaults[key] = value as unknown as FeatureFlagStore[string];
        }
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationPromise = this.fetchRemoteValues();
    return this.initializationPromise;
  }

  private async fetchRemoteValues(): Promise<void> {
    try {
      remoteConfig().setConfigSettings({
        minimumFetchIntervalMillis: __DEV__ ? 0 : 300_000,
        fetchTimeMillis: 300_000,
      });

      remoteConfig().setDefaults(this.defaults);

      await remoteConfig().fetchAndActivate();
      const parameterName =
        process.env.EXPO_PUBLIC_FEATURE_FLAG_REMOTE_CONFIG_PARAMETER?.trim() || DEFAULT_REMOTE_CONFIG_PARAMETER;
      const defaultFlags = parseFeatureFlagStore(remoteConfig().getValue(DEFAULT_REMOTE_CONFIG_PARAMETER).asString());
      const environmentFlags =
        parameterName === DEFAULT_REMOTE_CONFIG_PARAMETER
          ? {}
          : parseFeatureFlagStore(remoteConfig().getValue(parameterName).asString());
      this.remoteValues = { ...defaultFlags, ...environmentFlags };
    } catch (_error) {
      console.warn('Firebase Remote Config fetch failed, using defaults and env overrides');
    }
  }

  private getEnvOverride(key: string): string | undefined {
    if (process.env.EXPO_PUBLIC_FEATURE_FLAG_ENV_OVERRIDE === 'false') return undefined;
    const envKey = `EXPO_PUBLIC_FEATURE_FLAG_${key.toUpperCase().replace(/-/g, '_')}`;
    return process.env[envKey];
  }

  getBoolean(key: string, defaultValue = false): boolean {
    const envOverride = this.getEnvOverride(key);
    if (envOverride !== undefined) {
      return envOverride === 'true';
    }

    const remoteValue = this.remoteValues[key];
    if (typeof remoteValue === 'boolean') {
      return remoteValue;
    }

    const localDefault = this.defaults[key];
    if (typeof localDefault === 'boolean') {
      return localDefault;
    }
    return defaultValue;
  }

  getString(key: string, defaultValue = ''): string {
    const envOverride = this.getEnvOverride(key);
    if (envOverride !== undefined) return envOverride;

    const remoteValue = this.remoteValues[key];
    if (typeof remoteValue === 'string') {
      return remoteValue;
    }

    const localDefault = this.defaults[key];
    if (typeof localDefault === 'string') {
      return localDefault;
    }
    return defaultValue;
  }

  getNumber(key: string, defaultValue = 0): number {
    const envOverride = this.getEnvOverride(key);
    if (envOverride !== undefined) {
      const parsed = Number(envOverride);
      return Number.isNaN(parsed) ? defaultValue : parsed;
    }

    const remoteValue = this.remoteValues[key];
    if (typeof remoteValue === 'number') {
      return remoteValue;
    }

    const localDefault = this.defaults[key];
    if (typeof localDefault === 'number') {
      return localDefault;
    }
    return defaultValue;
  }

  getAll(): FeatureFlagStore {
    const result: FeatureFlagStore = { ...this.defaults, ...this.remoteValues };
    for (const key of Object.keys(result)) {
      const envOverride = this.getEnvOverride(key);
      if (envOverride === undefined) continue;

      const currentValue = result[key];
      if (typeof currentValue === 'boolean') {
        result[key] = envOverride === 'true';
      } else if (typeof currentValue === 'number') {
        const parsed = Number(envOverride);
        result[key] = Number.isNaN(parsed) ? currentValue : parsed;
      } else {
        result[key] = envOverride;
      }
    }
    return result;
  }
}

export const remoteConfigService = new RemoteConfigService();
