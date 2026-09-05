import type { ReactElement } from 'react';
import { Modal, View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';

interface LocationPrimingSheetProps {
  visible: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function LocationPrimingSheet({ visible, onConfirm, onDismiss }: LocationPrimingSheetProps): ReactElement {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-card rounded-t-xl p-lg gap-sm">
          <Text className="text-headline-md text-card-foreground">See events near you</Text>
          <Text className="text-body-md text-muted-foreground">
            Ganapps uses your location to show events happening near you in Iloilo City. Your exact position never
            leaves your device.
          </Text>
          <View className="flex-row gap-sm mt-sm">
            <View className="flex-1">
              <Button variant="outline" onPress={onDismiss}>
                Not now
              </Button>
            </View>
            <View className="flex-1">
              <Button onPress={onConfirm}>Continue</Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
