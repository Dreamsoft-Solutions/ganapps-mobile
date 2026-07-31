import { Image } from 'expo-image';
import { Calendar, MapPin, Users, X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
import type { Ganap } from '@/types/ganap.types';
import { formatEventDate } from '@/utils/formatting';

interface SelectedGanapCardProps {
  ganap: Ganap;
  onClose: () => void;
}

/**
 * Bottom card shown when a Ganap marker is selected.
 *
 * @param props - The selected Ganap and close handler.
 * @returns The card element.
 */
export function SelectedGanapCard({ ganap, onClose }: SelectedGanapCardProps): ReactElement {
  return (
    <View className="mx-4 mb-4 rounded-2xl bg-white p-4 shadow-lg">
      <Pressable
        onPress={onClose}
        className="absolute right-3 top-3 z-10 rounded-full bg-lynx-surface-container p-1"
        accessibilityLabel="Close event details"
      >
        <X size={16} className="text-lynx-on-surface-variant" />
      </Pressable>

      <View className="flex-row gap-3">
        {ganap.coverImage ? (
          <Image
            source={{ uri: ganap.coverImage }}
            contentFit="cover"
            className="h-20 w-20 rounded-xl bg-lynx-surface-container"
          />
        ) : (
          <View className="h-20 w-20 items-center justify-center rounded-xl bg-lynx-surface-container">
            <Calendar size={24} className="text-lynx-on-surface-variant" />
          </View>
        )}

        <View className="flex-1">
          <Text className="text-headline-sm text-lynx-on-surface mb-1" numberOfLines={2}>
            {ganap.title}
          </Text>
          <Text className="text-body-md text-lynx-primary mb-2" numberOfLines={1}>
            {ganap.businessName}
          </Text>

          <View className="flex-row items-center gap-1">
            <Calendar size={14} className="text-lynx-on-surface-variant" />
            <Text className="text-label-md text-lynx-on-surface-variant">{formatEventDate(ganap.startDate)}</Text>
          </View>

          {ganap.address && (
            <View className="mt-1 flex-row items-center gap-1">
              <MapPin size={14} className="text-lynx-on-surface-variant" />
              <Text className="text-label-md text-lynx-on-surface-variant flex-1" numberOfLines={1}>
                {ganap.address}
              </Text>
            </View>
          )}

          <View className="mt-2 flex-row items-center gap-1">
            <Users size={14} className="text-lynx-on-surface-variant" />
            <Text className="text-label-md text-lynx-on-surface-variant">{ganap.registrationCount} going</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
