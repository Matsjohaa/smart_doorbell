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
import { registerPushToken } from "../src/api";

export default function RootLayout() {
  const router = useRouter();

  // Register for push notifications and send token to the Pi
  useEffect(() => {
    (async () => {
      const token = await registerForNotifications();
      if (token) {
        try {
          await registerPushToken(token);
          console.log("Push token registered with Pi");
        } catch (e) {
          console.warn("Failed to register push token with Pi:", e);
        }
      }
    })();
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
