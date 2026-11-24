import { ArrowRight, Bookmark, Heart } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

interface WalkActionBarProps {
  isLiked: boolean;
  isSaved: boolean;
  isLikePending: boolean;
  isSavePending: boolean;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onNext: () => void;
}

/**
 * The walk's actions: Like and Save beside the primary Next.
 *
 * Next is the main action and takes the room. Like and Save stay icon-sized at 48dp each, so
 * the bar holds at enlarged text. It sits directly above the app tab bar, which already
 * reserves the bottom safe-area inset, so it adds only its own padding.
 *
 * @param props - The card's like and save state and the handlers
 * @returns The bottom action bar
 */
export function WalkActionBar({
  isLiked,
  isSaved,
  isLikePending,
  isSavePending,
  onToggleLike,
  onToggleSave,
  onNext,
}: WalkActionBarProps): ReactElement {
  const theme = useResolvedTheme();
  const likeColor: string = isLiked ? Colors[theme].like : Colors[theme].foreground;
  const saveColor: string = isSaved ? Colors[theme].save : Colors[theme].foreground;

  return (
    <View className="flex-row items-center gap-sm border-t border-border bg-background px-md pb-xs pt-sm">
      <IconButton
        variant="default"
        selected={isLiked}
        disabled={isLikePending}
        accessibilityLabel={isLiked ? 'Unlike event' : 'Like event'}
        onPress={onToggleLike}
      >
        <Heart size={20} color={likeColor} fill={isLiked ? likeColor : 'none'} />
      </IconButton>
      <IconButton
        variant="default"
        selected={isSaved}
        disabled={isSavePending}
        accessibilityLabel={isSaved ? 'Unsave event' : 'Save event'}
        onPress={onToggleSave}
      >
        <Bookmark size={20} color={saveColor} fill={isSaved ? saveColor : 'none'} />
      </IconButton>
      <View className="flex-1">
        <Button
          size="lg"
          accessibilityLabel="Next event"
          accessibilityHint="Moves to the next recommended event"
          rightIcon={<ArrowRight />}
          onPress={onNext}
        >
          Next
        </Button>
      </View>
    </View>
  );
}
