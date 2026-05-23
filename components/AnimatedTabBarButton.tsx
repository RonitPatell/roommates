import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

type Variant = 'default' | 'emphasis';

export function AnimatedTabBarButton({
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
  onLongPress,
  variant = 'default',
  ...rest
}: BottomTabBarButtonProps & { variant?: Variant }) {
  const scale = useSharedValue(1);
  const iconLift = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: iconLift.value }],
  }));

  const handlePressIn: BottomTabBarButtonProps['onPressIn'] = (e) => {
    scale.value = withSpring(variant === 'emphasis' ? 0.9 : 0.86, {
      damping: 16,
      stiffness: 420,
    });
    iconLift.value = withSpring(-2, { damping: 14, stiffness: 360 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPressIn?.(e);
  };

  const handlePressOut: BottomTabBarButtonProps['onPressOut'] = (e) => {
    if (variant === 'emphasis') {
      scale.value = withSequence(
        withSpring(1.14, { damping: 9, stiffness: 320 }),
        withSpring(1, { damping: 11, stiffness: 260 })
      );
    } else {
      scale.value = withSpring(1, { damping: 11, stiffness: 280 });
    }
    iconLift.value = withSpring(0, { damping: 12, stiffness: 300 });
    onPressOut?.(e);
  };

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={onLongPress}
      style={[style, styles.hit]}
    >
      <Animated.View style={[styles.inner, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    flex: 1,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
