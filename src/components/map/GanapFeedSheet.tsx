import BottomSheet, { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { X, ZoomIn } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { GanapFeedCard } from '@/components/lists/GanapFeedCard';
import { Colors } from '@/constants/theme';
import type { UseGanapsResult } from '@/hooks/useGanaps';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { GanapListItem } from '@/types/ganap.types';
import {
  buildFeedSheetSnapPoints,
  type FeedSheetMode,
  resolveClusterZoomTarget,
  resolveFeedSheetEmptyMessage,
  resolveFeedSheetMode,
  resolveFeedSheetTitle,
} from '@/utils/feed-sheet';
import {
  type ClusterZoomTarget,
  type GanapClusterFeature,
  type GanapClusterIndex,
  getClusterLeaves,
} from '@/utils/map-clustering';

export interface GanapFeedSheetProps {
  feed: UseGanapsResult;
  /** Whether a search or tag is active, so the empty state can say which emptiness this is. */
  hasActiveFilters: boolean;
  /** Whether a distance filter actually reached the server, so the title does not overclaim. */
  isNearbyApplied: boolean;
  /**
   * Height of everything floating above the sheet — the safe-area inset plus the
   * search bar and chips. The sheet never rises past it, so the title stays clear
   * of the status bar and the filters stay reachable while the feed is expanded.
   */
  topOverlayHeight: number;
  selectedGanap: GanapListItem | null;
  selectedCluster: GanapClusterFeature | null;
  clusterIndex: GanapClusterIndex;
  onSelectGanap: (ganap: GanapListItem) => void;
  onClearSelection: (reason?: 'keep-current') => void;
  onZoomToCluster: (target: ClusterZoomTarget) => void;
}

interface FeedSheetHeaderProps {
  title: string;
  mode: FeedSheetMode;
  onZoomIn: () => void;
  onClearSelection: () => void;
}

/**
 * The sheet's grab handle: the drag indicator, the title, and the controls that
 * leave a selection.
 *
 * This is passed to `BottomSheet` as `handleComponent` rather than rendered as a
 * sibling of the body. `BottomSheetView` is `position: 'absolute', top: 0` — it
 * is the sheet's single content container, not a stacking box — so a header
 * rendered beside the list would sit underneath it at the same origin. Being the
 * handle also means dragging from the title works, and the title stays put while
 * the list scrolls.
 *
 * Supplying `handleComponent` replaces the library's own indicator, so this
 * draws it.
 *
 * @param props - The title, the current mode, and the two actions
 * @returns The handle
 */
function FeedSheetHeader({ title, mode, onZoomIn, onClearSelection }: FeedSheetHeaderProps): ReactElement {
  const theme = useResolvedTheme();

  return (
    <View testID="ganap-feed-sheet-header" className="pt-sm">
      <View className="h-1 w-10 self-center rounded-full" style={{ backgroundColor: Colors[theme].border }} />

      <View className="mt-sm flex-row items-center justify-between px-md pb-xs">
        <Text accessibilityRole="header" className="font-inter-bold text-body-xl text-foreground">
          {title}
        </Text>

        <View className="flex-row items-center gap-sm">
          {mode === 'cluster' && (
            <Pressable onPress={onZoomIn} accessibilityRole="button" accessibilityLabel="Zoom in to this area">
              <ZoomIn size={20} color={Colors[theme].primary} />
            </Pressable>
          )}
          {mode !== 'browse' && (
            <Pressable onPress={onClearSelection} accessibilityRole="button" accessibilityLabel="Close events list">
              <X size={20} color={Colors[theme]['muted-foreground']} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

interface FeedSheetBodyProps {
  mode: FeedSheetMode;
  feed: UseGanapsResult;
  items: GanapListItem[];
  hasActiveFilters: boolean;
  onSelectGanap: (ganap: GanapListItem) => void;
  onEndReached: () => void;
}

/**
 * Whatever the sheet is currently showing: a state, or the list.
 *
 * Loading and error belong to the feed query, so they surface only in `browse`.
 * A cluster or a single selection always has its items in hand already.
 *
 * @param props - The mode, the feed query, and the rows to render
 * @returns The sheet body
 */
function FeedSheetBody({
  mode,
  feed,
  items,
  hasActiveFilters,
  onSelectGanap,
  onEndReached,
}: FeedSheetBodyProps): ReactElement {
  if (mode === 'browse' && feed.isLoading) {
    return (
      <BottomSheetView>
        <View className="h-40">
          <Loading message="Finding events..." />
        </View>
      </BottomSheetView>
    );
  }

  if (mode === 'browse' && feed.error) {
    return (
      <BottomSheetView>
        <View className="h-40">
          <ErrorView error={feed.error} />
        </View>
      </BottomSheetView>
    );
  }

  if (items.length === 0) {
    return (
      <BottomSheetView>
        <View className="h-40">
          <Empty message={resolveFeedSheetEmptyMessage({ mode, hasActiveFilters })} />
        </View>
      </BottomSheetView>
    );
  }

  return (
    <BottomSheetFlatList
      testID="ganap-feed-sheet-list"
      data={items}
      keyExtractor={(item: GanapListItem): string => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      renderItem={({ item }: { item: GanapListItem }): ReactElement => (
        <GanapFeedCard ganap={item} onPress={(): void => onSelectGanap(item)} />
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={feed.isFetchingNextPage ? <Loading /> : null}
    />
  );
}

/**
 * The map tab's selection sheet, mounted for a selected pin or cluster.
 *
 * It keeps the map unobstructed until the user selects a map feature, then shows
 * the selected Ganap or the selected cluster's leaves.
 *
 * In `cluster` mode the list is the cluster's leaves — a local array derived
 * from the map's single large page — not the infinite feed.
 *
 * @param props - The feed query, the current selection, and the map callbacks
 * @returns The bottom sheet
 */
export function GanapFeedSheet({
  feed,
  hasActiveFilters,
  isNearbyApplied,
  topOverlayHeight,
  selectedGanap,
  selectedCluster,
  clusterIndex,
  onSelectGanap,
  onClearSelection,
  onZoomToCluster,
}: GanapFeedSheetProps): ReactElement {
  const sheetRef = useRef<BottomSheet>(null);
  const theme = useResolvedTheme();

  const { mode } = resolveFeedSheetMode({ selectedGanap, selectedCluster });

  const snapPoints = useMemo((): (string | number)[] => buildFeedSheetSnapPoints(), []);

  /**
   * Re-resolved inside the effect so the selection itself is the dependency.
   * Depending on `snapIndex` alone would miss a browse-to-selected change, since
   * both resolve to the peek — leaving a sheet the user had dragged open still
   * showing the whole feed after they tapped a single pin.
   */
  useEffect((): void => {
    const target = resolveFeedSheetMode({ selectedGanap, selectedCluster });
    sheetRef.current?.snapToIndex(target.snapIndex);
  }, [selectedGanap, selectedCluster]);

  const leaves: GanapListItem[] = useMemo(
    (): GanapListItem[] => (selectedCluster === null ? [] : getClusterLeaves(clusterIndex, selectedCluster)),
    [clusterIndex, selectedCluster],
  );

  const items: GanapListItem[] = useMemo((): GanapListItem[] => {
    if (mode === 'cluster') return leaves;
    if (mode === 'selected' && selectedGanap) return [selectedGanap];
    return feed.items;
  }, [mode, leaves, selectedGanap, feed.items]);

  const title: string = resolveFeedSheetTitle({ mode, leafCount: leaves.length, isNearbyApplied });

  const handleEndReached = useCallback((): void => {
    if (mode !== 'browse') return;
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, [mode, feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage]);

  const handleSheetChange = useCallback(
    (index: number): void => {
      if (index < 0) onClearSelection();
    },
    [onClearSelection],
  );

  const handleZoomIn = useCallback((): void => {
    if (!selectedCluster) return;
    const target = resolveClusterZoomTarget(clusterIndex, selectedCluster);
    if (target === null) return;
    onZoomToCluster(target);
    /**
     * Expanding the cluster dissolves it, and the screen only clears a selection
     * when the dataset changes — which zooming does not do. Without this the
     * sheet keeps listing leaves of a cluster that no longer exists.
     */
    onClearSelection('keep-current');
  }, [clusterIndex, onZoomToCluster, onClearSelection, selectedCluster]);

  const renderHandle = useCallback(
    (): ReactElement => (
      <FeedSheetHeader title={title} mode={mode} onZoomIn={handleZoomIn} onClearSelection={onClearSelection} />
    ),
    [title, mode, handleZoomIn, onClearSelection],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      topInset={topOverlayHeight}
      enablePanDownToClose
      enableDynamicSizing={false}
      backgroundStyle={{ backgroundColor: Colors[theme].card }}
      handleComponent={renderHandle}
      onChange={handleSheetChange}
    >
      <FeedSheetBody
        mode={mode}
        feed={feed}
        items={items}
        hasActiveFilters={hasActiveFilters}
        onSelectGanap={onSelectGanap}
        onEndReached={handleEndReached}
      />
    </BottomSheet>
  );
}
