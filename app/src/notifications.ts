/**
 * Push notification helpers using expo-notifications.
 *
 * Registers for push notifications and subscribes to the "doorbell" FCM topic.
 * On receiving a notification, it can be handled in the app.
 */

import { useEffect, useRef } from "react";
import { Platform, Alert } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and return the Expo push token.
 * On a real device, this also grants the required permissions.
 */
export async function registerForNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device.");
    return null;
  }

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    Alert.alert(
      "Notifications disabled",
      "Enable notifications in Settings to receive doorbell alerts."
    );
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("doorbell", {
      name: "Doorbell Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }

  // Get the push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "957a0e7f-04b2-4e1e-84ff-f48006ebac26",
    });
    console.log("Expo push token:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.warn("Could not get push token (expected in Expo Go):", error);
    return null;
  }
}

/**
 * React hook that sets up notification listeners.
 *
 * @param onNotificationReceived - called when a notification arrives while app is open
 * @param onNotificationTapped   - called when user taps a notification
 */
export function useNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
) {
  const receivedRef = useRef<Notifications.EventSubscription>(null);
  const responseRef = useRef<Notifications.EventSubscription>(null);

  useEffect(() => {
    receivedRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received:", notification);
        onNotificationReceived?.(notification);
      }
    );

    responseRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("Notification tapped:", response);
        onNotificationTapped?.(response);
      }
    );

    return () => {
      receivedRef.current?.remove();
      responseRef.current?.remove();
    };
  }, [onNotificationReceived, onNotificationTapped]);
}
