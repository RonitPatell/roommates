import React from 'react';
import { Platform, ScrollView, ScrollViewProps, StyleSheet } from 'react-native';

import { AppRefreshControl } from '@/components/AppRefreshControl';

/** Extra space below the safe area so the full spinner is visible. */
export const SPINNER_CLEARANCE = 28;

export function refreshInsetTop(safeAreaTop: number) {
  return safeAreaTop + SPINNER_CLEARANCE;
}

interface RefreshableScrollViewProps extends ScrollViewProps {
  refreshing: boolean;
  onRefresh: () => void;
  /** Top safe-area inset — pass `insets.top` from useSafeAreaInsets(). */
  safeAreaTop?: number;
  /**
   * iOS content inset for the refresh spinner (default true).
   * Disable on screens that use a fixed top gradient backdrop (e.g. My Chores).
   */
  useContentInset?: boolean;
}

/**
 * ScrollView with pull-to-refresh that works even when content is short
 * (flexGrow + overscroll) and positions the spinner below the status bar.
 */
export function RefreshableScrollView({
  refreshing,
  onRefresh,
  safeAreaTop = 0,
  useContentInset = true,
  contentContainerStyle,
  children,
  ...rest
}: RefreshableScrollViewProps) {
  const refreshTop = safeAreaTop + SPINNER_CLEARANCE;
  const inset = useContentInset && Platform.OS === 'ios' ? refreshTop : 0;

  return (
    <ScrollView
      {...rest}
      alwaysBounceVertical
      overScrollMode="always"
      automaticallyAdjustContentInsets={false}
      contentInset={inset > 0 ? { top: inset } : undefined}
      contentOffset={inset > 0 ? { x: 0, y: -inset } : undefined}
      scrollIndicatorInsets={inset > 0 ? { top: inset } : undefined}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      refreshControl={
        <AppRefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          progressViewOffset={
            Platform.OS === 'android' || !useContentInset ? refreshTop : 0
          }
        />
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
});
