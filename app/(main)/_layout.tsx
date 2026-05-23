import { Stack } from 'expo-router';



export default function MainLayout() {

  return (

    <Stack screenOptions={{ headerShown: false }}>

      <Stack.Screen name="(tabs)" />

      <Stack.Screen

        name="chore/[id]"

        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}

      />

      <Stack.Screen name="upgrade" options={{ animation: 'slide_from_right' }} />

    </Stack>

  );

}


