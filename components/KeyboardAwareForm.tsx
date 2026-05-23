import React from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Scrollable form that lets the system adjust insets when the keyboard opens.
 * Avoid stacking KeyboardAvoidingView, manual keyboard padding, and scrollToEnd —
 * that combination causes the jumpy scroll users see on focus.
 */
export function KeyboardAwareForm({
  children,
  contentContainerStyle,
  bottomInset = 24,
}: {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  bottomInset?: number;
}) {
  return (
    <ScrollView
      style={styles.flex}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[contentContainerStyle, { paddingBottom: bottomInset }]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
