import type { LucideIcon } from 'lucide-react-native';
import { Check, Monitor, Moon, Sun } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { DeleteAccountFlow } from '@/components/profile/DeleteAccountFlow';
import { useAuth } from '@/hooks/useAuth';
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
  const { deleteAccount, deleteAccountMutation } = useAuth();
  const [isDeleteFlowVisible, setIsDeleteFlowVisible] = useState<boolean>(false);

  const openDeleteFlow = (): void => {
    deleteAccountMutation.reset();
    setIsDeleteFlowVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 p-md">
        <Text className="text-headline-md mb-md">Settings</Text>
        <Text className="text-label-md text-muted-foreground mb-xs">Theme</Text>
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
                  isActive ? 'border-primary bg-muted' : 'border-border bg-card'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
                <Text className="text-body-md ml-sm flex-1">{option.label}</Text>
                {isActive && <Check size={20} className="text-primary" />}
              </Pressable>
            );
          })}
        </View>
        <View className="mt-xl">
          <Button
            accessibilityHint="Opens an irreversible account deletion confirmation"
            onPress={openDeleteFlow}
            variant="destructive"
          >
            Delete account
          </Button>
        </View>
      </View>
      <DeleteAccountFlow
        visible={isDeleteFlowVisible}
        isDeleting={deleteAccountMutation.isPending}
        error={deleteAccountMutation.error}
        onClose={(): void => setIsDeleteFlowVisible(false)}
        onDelete={deleteAccount}
      />
    </SafeAreaView>
  );
}
