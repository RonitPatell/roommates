import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface AnimatedIconButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
}

/** Circular / icon control with press scale, glow, and a subtle wiggle. */
export function AnimatedIconButton({
  children,
  onPress,
  style,
  hitSlop = 8,
  accessibilityLabel,
}: AnimatedIconButtonProps) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const highlight = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlight.value * 0.45,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.88, { damping: 14, stiffness: 400 });
    highlight.value = withTiming(1, { duration: 80 });
    rotate.value = withSpring(-6, { damping: 12, stiffness: 380 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 280 });
    highlight.value = withTiming(0, { duration: 160 });
    rotate.value = withSpring(0, { damping: 11, stiffness: 260 });
  };

  const handlePress = () => {
    rotate.value = withSequence(
      withSpring(14, { damping: 8, stiffness: 340 }),
      withSpring(-8, { damping: 9, stiffness: 320 }),
      withSpring(0, { damping: 12, stiffness: 280 })
    );
    scale.value = withSequence(
      withSpring(0.92, { damping: 14, stiffness: 400 }),
      withSpring(1.06, { damping: 9, stiffness: 300 }),
      withSpring(1, { damping: 11, stiffness: 260 })
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.btn, style, animatedStyle]}>
        <Animated.View pointerEvents="none" style={[styles.highlight, highlightStyle]} />
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 18,
  },
});
