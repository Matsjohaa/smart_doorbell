/**
 * Live View screen — displays the MJPEG camera stream from the Pi.
 */

import { useState } from "react";
import {
  View,
  Image,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { getStreamUrl, triggerDoorbell } from "../../src/api";
import { Colors, Spacing } from "../../src/theme";

export default function LiveScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const streamUrl = getStreamUrl();

  const handleTrigger = async () => {
    try {
      await triggerDoorbell();
      Alert.alert("Triggered", "Doorbell button simulated!");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.streamContainer}>
        {loading && !error && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.overlayText}>Connecting to camera…</Text>
          </View>
        )}

        {error && (
          <View style={styles.overlay}>
            <Ionicons name="videocam-off" size={48} color={Colors.textSecondary} />
            <Text style={styles.overlayText}>
              Could not connect to the camera.{"\n"}
              Make sure the Pi is running and on the same network.
            </Text>
          </View>
        )}

        <Image
          source={{ uri: streamUrl }}
          style={styles.stream}
          resizeMode="contain"
          onLoad={() => {
            setLoading(false);
            setError(false);
          }}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      </View>

      {/* Test button: simulate doorbell press */}
      <TouchableOpacity style={styles.triggerButton} onPress={handleTrigger}>
        <Ionicons name="notifications-outline" size={22} color="#fff" />
        <Text style={styles.triggerText}>Simulate Doorbell</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  streamContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  stream: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    zIndex: 1,
  },
  overlayText: {
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: "center",
    fontSize: 14,
  },
  triggerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  triggerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
