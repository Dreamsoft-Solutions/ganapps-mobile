import type { ReactElement } from 'react';
import { Linking, View } from 'react-native';
import { showToast } from '@/store/toast.store';
import { Button } from './Button';

interface LegalLinksProps {
  includeDeletion?: boolean;
}

async function openLegalPage(url: string | undefined): Promise<void> {
  try {
    if (!url || new URL(url).protocol !== 'https:') throw new Error('Missing legal URL');
    await Linking.openURL(url);
  } catch {
    showToast('error', 'Unable to open this page. Please try again later.');
  }
}

/**
 * Opens public policy pages and the account deletion request resource.
 * @param props - Whether to include account deletion alongside the policy links.
 * @returns Accessible policy controls shared by authentication and settings.
 */
export function LegalLinks({ includeDeletion = false }: LegalLinksProps): ReactElement {
  return (
    <View className="gap-xs">
      <Button variant="link" onPress={(): Promise<void> => openLegalPage(process.env.EXPO_PUBLIC_TERMS_URL)}>
        Terms of Service
      </Button>
      <Button variant="link" onPress={(): Promise<void> => openLegalPage(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL)}>
        Privacy Policy
      </Button>
      {includeDeletion && (
        <Button
          variant="outline"
          accessibilityHint="Opens the website to request deletion of your account and associated data"
          onPress={(): Promise<void> => openLegalPage(process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL)}
        >
          Delete account
        </Button>
      )}
    </View>
  );
}
