import React from 'react';
import { Platform, RefreshControl, RefreshControlProps } from 'react-native';

import { colors } from '@/constants/theme';

interface AppRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
  /** Android only — vertical offset for the refresh indicator. */
  progressViewOffset?: number;
}

export function AppRefreshControl({
  refreshing,
  onRefresh,
  progressViewOffset = 0,
}: AppRefreshControlProps) {
  const common: RefreshControlProps = {
    refreshing,
    onRefresh,
    tintColor: colors.chrome,
    colors: [colors.chrome, colors.chromeBright, colors.accent],
    progressBackgroundColor: colors.surface,
    progressViewOffset,
  };

  if (Platform.OS === 'ios') {
    return (
      <RefreshControl
        {...common}
        title={refreshing ? 'Refreshing…' : undefined}
        titleColor={colors.textTertiary}
      />
    );
  }

  return <RefreshControl {...common} />;
}
