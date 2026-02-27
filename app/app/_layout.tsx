/**
 * Root layout — wraps the entire app.
 * expo-router uses this file automatically.
 */

import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

import {
  registerForNotifications,
  useNotificationListeners,
} from "../src/notifications";

export default function RootLayout() {
  const router = useRouter();

  // Register for push notifications on mount
  useEffect(() => {
    registerForNotifications();
  }, []);

  // Navigate to notifications tab when a push notification is tapped
  useNotificationListeners(
    undefined, // onReceived — we don't need to do anything special
    (_response) => {
      router.push("/(tabs)/notifications");
    }
  );

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
