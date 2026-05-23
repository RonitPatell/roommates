import { Stack } from 'expo-router';

export default function GroupsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 280,
      }}
    />
  );
}
