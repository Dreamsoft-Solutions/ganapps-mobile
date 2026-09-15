import { useEffect, useState } from 'react';
import { remoteConfigService } from '@/services/remote-config.service';

export function useFeatureFlag(key: string, defaultValue = false): boolean {
  const [value, setValue] = useState(() => remoteConfigService.getBoolean(key, defaultValue));

  useEffect(() => {
    let active = true;
    void remoteConfigService.initialize().then((): void => {
      if (active) setValue(remoteConfigService.getBoolean(key, defaultValue));
    });
    return (): void => {
      active = false;
    };
  }, [key, defaultValue]);

  return value;
}

export function useFeatureFlagString(key: string, defaultValue = ''): string {
  const [value, setValue] = useState(() => remoteConfigService.getString(key, defaultValue));

  useEffect(() => {
    let active = true;
    void remoteConfigService.initialize().then((): void => {
      if (active) setValue(remoteConfigService.getString(key, defaultValue));
    });
    return (): void => {
      active = false;
    };
  }, [key, defaultValue]);

  return value;
}

export function useFeatureFlagNumber(key: string, defaultValue = 0): number {
  const [value, setValue] = useState(() => remoteConfigService.getNumber(key, defaultValue));

  useEffect(() => {
    let active = true;
    void remoteConfigService.initialize().then((): void => {
      if (active) setValue(remoteConfigService.getNumber(key, defaultValue));
    });
    return (): void => {
      active = false;
    };
  }, [key, defaultValue]);

  return value;
}
