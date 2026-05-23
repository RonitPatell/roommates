import React, { useMemo } from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';

import { APP_NAME } from '@/constants/app';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Transparent PNG — exact generated mark (no black matte). */
const LOGO_SOURCE = require('@/assets/roommates-logo.png');

const OUTER: Record<Size, number> = {
  xs: 56,
  sm: 72,
  md: 96,
  lg: 140,
  xl: 176,
};

export function RumiLogo({
  size = 'md',
  style,
}: {
  size?: Size;
  style?: ViewStyle;
}) {
  const outer = useMemo(() => OUTER[size], [size]);

  return (
    <View style={[styles.wrap, { width: outer, height: outer }, style]}>
      <Image
        source={LOGO_SOURCE}
        style={{ width: outer, height: outer }}
        resizeMode="contain"
        accessibilityLabel={`${APP_NAME} logo`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
