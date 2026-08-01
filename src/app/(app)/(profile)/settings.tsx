import type { LucideIcon } from 'lucide-react-native';
import { Check, Monitor, Moon, Sun } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { type ThemeMode, useThemeStore } from '@/store/theme.store';

interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: LucideIcon;
}

const THEME_OPTIONS: ThemeOption[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'System', icon: Monitor },
];

export default function SettingsScreen(): ReactElement {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <View className="flex-1 bg-lynx-background p-md">
      <Text className="text-headline-md mb-md">Settings</Text>
      <Text className="text-label-md text-lynx-on-surface-variant mb-xs">Theme</Text>
      <View className="gap-sm">
        {THEME_OPTIONS.map((option: ThemeOption): ReactElement => {
          const isActive = option.mode === mode;
          const Icon = option.icon;
          return (
            <Pressable
              key={option.mode}
              onPress={(): void => {
                void setMode(option.mode);
              }}
              className={`flex-row items-center rounded-md border p-md ${
                isActive
                  ? 'border-lynx-primary bg-lynx-surface-container-low'
                  : 'border-lynx-outline-variant bg-lynx-surface'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-lynx-primary' : 'text-lynx-on-surface-variant'} />
              <Text className="text-body-md ml-sm flex-1">{option.label}</Text>
              {isActive && <Check size={20} className="text-lynx-primary" />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
