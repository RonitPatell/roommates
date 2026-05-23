import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors, radius } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CheckButton({
  checked,
  onPress,
  onLockedPress,
  accentColor = colors.tint,
  completeDisabled = false,
}: {
  checked: boolean;
  onPress: () => void;
  /** Fired when user taps while completion is locked (does not call onPress). */
  onLockedPress?: () => void;
  accentColor?: string;
  /** Block marking incomplete chores done (un-check always allowed). */
  completeDisabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const checkScale = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    checkScale.value = withSpring(checked ? 1 : 0, { damping: 14, stiffness: 200 });
  }, [checked, checkScale]);

  const locked = !checked && completeDisabled;

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: checked ? accentColor : locked ? colors.border : colors.border,
    backgroundColor: checked ? accentColor : 'transparent',
    opacity: locked ? 0.35 : 1,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const handlePress = () => {
    if (!checked && completeDisabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onLockedPress?.();
      return;
    }

    scale.value = withSequence(
      withSpring(0.88, { damping: 8 }),
      withSpring(1, { damping: 12 })
    );
    if (!checked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <AnimatedPressable onPress={handlePress} style={[styles.box, containerStyle]} hitSlop={12}>
      <Animated.View style={checkStyle}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 13l4 4L19 7"
            stroke="#FFFFFF"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
