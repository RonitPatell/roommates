import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';

import { HERO_BACKDROP_COLORS } from '@/components/HomeHero';
import { SPINNER_CLEARANCE } from '@/components/RefreshableScrollView';

/** Fixed gradient behind the status bar + pull-to-refresh zone on My Chores. */
export function HeroRefreshBackdrop({ safeAreaTop }: { safeAreaTop: number }) {
  const height = safeAreaTop + SPINNER_CLEARANCE + 120;

  return (
    <LinearGradient
      pointerEvents="none"
      colors={[...HERO_BACKDROP_COLORS]}
      locations={[0, 0.45, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.backdrop, { height }]}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
});
