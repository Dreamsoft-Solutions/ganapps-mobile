declare module '@react-native-firebase/remote-config' {
  export enum ValueSource {
    DefaultValue = 0,
    RemoteValue = 1,
    StaticValue = 2,
  }

  export interface ConfigSettings {
    minimumFetchIntervalMillis?: number;
    fetchTimeMillis?: number;
  }

  export interface ConfigValue {
    source: string;
    asBoolean(): boolean;
    asString(): string;
    asNumber(): number;
    getSource(): string;
  }

  export interface RemoteConfigModule {
    setConfigSettings(settings: ConfigSettings): void;
    setDefaults(defaults: Record<string, unknown>): void;
    fetch(expirationDurationSeconds?: number): Promise<void>;
    activate(): Promise<boolean>;
    fetchAndActivate(): Promise<boolean>;
    getValue(key: string): ConfigValue;
    getBoolean(key: string): boolean;
    getString(key: string): string;
    getNumber(key: string): number;
    getAll(): Record<string, ConfigValue>;
    ensureInitialized(): Promise<void>;
  }

  const defaultExport: () => RemoteConfigModule;
  export default defaultExport;
}
