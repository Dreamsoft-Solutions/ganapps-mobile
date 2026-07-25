import { useEffect, useState } from 'react';
import { remoteConfigService } from '@/services/remote-config.service';

export function useFeatureFlag(key: string, defaultValue = false): boolean {
  const [value, setValue] = useState(() => remoteConfigService.getBoolean(key, defaultValue));

  useEffect(() => {
    setValue(remoteConfigService.getBoolean(key, defaultValue));
  }, [key, defaultValue]);

  return value;
}

export function useFeatureFlagString(key: string, defaultValue = ''): string {
  const [value, setValue] = useState(() => remoteConfigService.getString(key, defaultValue));

  useEffect(() => {
    setValue(remoteConfigService.getString(key, defaultValue));
  }, [key, defaultValue]);

  return value;
}

export function useFeatureFlagNumber(key: string, defaultValue = 0): number {
  const [value, setValue] = useState(() => remoteConfigService.getNumber(key, defaultValue));

  useEffect(() => {
    setValue(remoteConfigService.getNumber(key, defaultValue));
  }, [key, defaultValue]);

  return value;
}
