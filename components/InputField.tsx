import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

export function InputField({
  label,
  error,
  style,
  placeholderTextColor,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        placeholderTextColor={placeholderTextColor ?? colors.textTertiary}
        style={[styles.input, error && styles.inputError, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.borderChrome,
  },
  inputError: { borderColor: colors.destructive },
  error: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.destructive,
    marginLeft: 4,
  },
});
