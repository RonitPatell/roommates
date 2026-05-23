import { Ionicons } from '@expo/vector-icons';

import { Tabs, useRouter } from 'expo-router';

import { Platform, Pressable, StyleSheet } from 'react-native';



import { AnimatedTabBarButton } from '@/components/AnimatedTabBarButton';

import { colors } from '@/constants/theme';

import { useChores } from '@/context/ChoresContext';

import { useLockIn } from '@/context/LockInContext';

import { routes } from '@/lib/routes';



export default function TabLayout() {

  const { pendingTradesForMe } = useChores();

  const { unreadCount: nudgeUnread } = useLockIn();

  const router = useRouter();

  const tradeBadge = pendingTradesForMe.length > 0 ? pendingTradesForMe.length : undefined;

  const moreBadge = nudgeUnread > 0 ? nudgeUnread : undefined;



  return (

    <Tabs

      screenOptions={{

        headerShown: false,

        tabBarActiveTintColor: colors.chromeBright,

        tabBarInactiveTintColor: colors.textTertiary,

        tabBarStyle: styles.tabBar,

        tabBarLabelStyle: styles.tabLabel,

        tabBarBackground: () => null,

        tabBarButton: (props) => <AnimatedTabBarButton {...props} />,

      }}

    >

      <Tabs.Screen

        name="index"

        options={{

          title: 'Home',

          tabBarIcon: ({ color, size }) => (

            <Ionicons name="home-outline" size={size} color={color} />

          ),

          headerRight: () => (

            <Pressable onPress={() => router.push(routes.groups)} style={{ marginRight: 8 }}>

              <Ionicons name="people-outline" size={22} color={colors.chrome} />

            </Pressable>

          ),

        }}

      />

      <Tabs.Screen

        name="calendar"

        options={{

          title: 'Calendar',

          tabBarIcon: ({ color, size }) => (

            <Ionicons name="calendar-outline" size={size} color={color} />

          ),

        }}

      />

      <Tabs.Screen

        name="manage"

        options={{

          title: 'Add',

          tabBarIcon: ({ color, size }) => (

            <Ionicons name="add-circle" size={size + 4} color={color} />

          ),

          tabBarButton: (props) => <AnimatedTabBarButton {...props} variant="emphasis" />,

        }}

      />

      <Tabs.Screen

        name="trade"

        options={{

          title: 'Swap',

          tabBarBadge: tradeBadge,

          tabBarIcon: ({ color, size }) => (

            <Ionicons name="swap-horizontal-outline" size={size} color={color} />

          ),

        }}

      />

      <Tabs.Screen

        name="more"

        options={{

          title: 'More',

          tabBarBadge: moreBadge,

          tabBarIcon: ({ color, size }) => (

            <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} />

          ),

        }}

      />

      <Tabs.Screen name="scores" options={{ href: null }} />

      <Tabs.Screen name="nudge" options={{ href: null }} />

    </Tabs>

  );

}



const styles = StyleSheet.create({

  tabBar: {

    backgroundColor: colors.tabBar,

    borderTopWidth: StyleSheet.hairlineWidth,

    borderTopColor: colors.separator,

    height: Platform.OS === 'ios' ? 84 : 64,

    paddingTop: 4,

  },

  tabLabel: {

    fontFamily: 'Outfit_500Medium',

    fontSize: 10,

    marginTop: -2,

  },

});


