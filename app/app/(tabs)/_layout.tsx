/**
 * Tab layout — bottom navigation with three tabs:
 *   1. Live  (camera stream)
 *   2. Notifications (event log)
 *   3. People (manage known faces)
 */

import { useCallback, useState } from "react";
import { Tabs, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/theme";
import { fetchEvents } from "../../src/api";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export default function TabLayout() {
  const [unseenCount, setUnseenCount] = useState(0);

  // Poll for unseen events periodically
  const loadUnseenCount = useCallback(async () => {
    try {
      const events = await fetchEvents();
      setUnseenCount(events.filter((e) => !e.seen).length);
    } catch {
      // ignore — Pi may be offline
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUnseenCount();
      const interval = setInterval(loadUnseenCount, 15_000);
      return () => clearInterval(interval);
    }, [loadUnseenCount])
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
        },
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Live",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="videocam" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarBadge: unseenCount > 0 ? unseenCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.danger,
            fontSize: 11,
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: "People",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
