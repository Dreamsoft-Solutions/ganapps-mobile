import remoteConfig from '@react-native-firebase/remote-config';

interface FeatureFlagStore {
  [key: string]: boolean | string | number;
}

const DEFAULT_CONFIG = require('../../config/feature-flags/default.json');

class RemoteConfigService {
  private defaults: FeatureFlagStore = {};
  private initialized = false;

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
    try {
      remoteConfig().setConfigSettings({
        minimumFetchIntervalMillis: __DEV__ ? 0 : 300_000,
        fetchTimeMillis: 300_000,
      });

      remoteConfig().setDefaults(this.defaults);

      await remoteConfig().fetchAndActivate();

      this.initialized = true;
    } catch (_error) {
      console.warn('Firebase Remote Config fetch failed, using defaults and env overrides');
      this.initialized = true;
    }
  }

  private getEnvOverride(key: string): string | undefined {
    const envKey = `EXPO_PUBLIC_FEATURE_FLAG_${key.toUpperCase().replace(/-/g, '_')}`;
    return process.env[envKey];
  }

  getBoolean(key: string, defaultValue = false): boolean {
    const envOverride = this.getEnvOverride(key);
    if (envOverride !== undefined) {
      return envOverride === 'true';
    }

    if (!this.initialized) {
      return typeof this.defaults[key] === 'boolean' ? (this.defaults[key] as boolean) : defaultValue;
    }

    const value = remoteConfig().getValue(key);
    try {
      return value.asBoolean();
    } catch {
      return defaultValue;
    }
  }

  getString(key: string, defaultValue = ''): string {
    const envOverride = this.getEnvOverride(key);
    if (envOverride !== undefined) return envOverride;

    if (!this.initialized) {
      return typeof this.defaults[key] === 'string' ? (this.defaults[key] as string) : defaultValue;
    }

    const value = remoteConfig().getValue(key);
    try {
      return value.asString();
    } catch {
      return defaultValue;
    }
  }

  getNumber(key: string, defaultValue = 0): number {
    const envOverride = this.getEnvOverride(key);
    if (envOverride !== undefined) {
      const parsed = Number(envOverride);
      return Number.isNaN(parsed) ? defaultValue : parsed;
    }

    if (!this.initialized) {
      return typeof this.defaults[key] === 'number' ? (this.defaults[key] as number) : defaultValue;
    }

    const value = remoteConfig().getValue(key);
    try {
      return value.asNumber();
    } catch {
      return defaultValue;
    }
  }

  getAll(): FeatureFlagStore {
    return { ...this.defaults };
  }
}

export const remoteConfigService = new RemoteConfigService();
