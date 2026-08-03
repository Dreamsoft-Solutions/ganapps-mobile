import { Image } from 'expo-image';
import { Calendar, MapPin, Users, X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
import type { GanapListItem } from '@/types/ganap.types';
import { formatEventDate } from '@/utils/formatting';

interface SelectedGanapCardProps {
  ganap: GanapListItem;
  onClose: () => void;
  onPress: () => void;
}

/**
 * Bottom card shown when a Ganap marker is selected.
 *
 * @param props - The selected Ganap, detail handler, and close handler.
 * @returns The card element.
 */
export function SelectedGanapCard({ ganap, onClose, onPress }: SelectedGanapCardProps): ReactElement {
  return (
    <View className="mx-4 mb-4 rounded-2xl bg-card p-4 shadow-lg">
      <Pressable
        onPress={onClose}
        className="absolute right-3 top-3 z-10 rounded-full bg-muted p-1"
        accessibilityLabel="Close event details"
      >
        <X size={16} className="text-muted-foreground" />
      </Pressable>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open event details for ${ganap.title}`}
        accessibilityHint="Opens the full event details"
        className="flex-row gap-3"
      >
        {ganap.coverImage ? (
          <Image source={{ uri: ganap.coverImage }} contentFit="cover" className="h-20 w-20 rounded-xl bg-muted" />
        ) : (
          <View className="h-20 w-20 items-center justify-center rounded-xl bg-muted">
            <Calendar size={24} className="text-muted-foreground" />
          </View>
        )}

        <View className="flex-1">
          <Text className="text-headline-sm text-foreground mb-1" numberOfLines={2}>
            {ganap.title}
          </Text>
          <Text className="text-body-md text-primary mb-2" numberOfLines={1}>
            {ganap.businessName}
          </Text>

          <View className="flex-row items-center gap-1">
            <Calendar size={14} className="text-muted-foreground" />
            <Text className="text-label-md text-muted-foreground">{formatEventDate(ganap.startDate)}</Text>
          </View>

          {ganap.address && (
            <View className="mt-1 flex-row items-center gap-1">
              <MapPin size={14} className="text-muted-foreground" />
              <Text className="text-label-md text-muted-foreground flex-1" numberOfLines={1}>
                {ganap.address}
              </Text>
            </View>
          )}

          <View className="mt-2 flex-row items-center gap-1">
            <Users size={14} className="text-muted-foreground" />
            <Text className="text-label-md text-muted-foreground">{ganap.registrationCount} going</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
