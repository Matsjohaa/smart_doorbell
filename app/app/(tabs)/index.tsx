/**
 * Live View screen — displays the MJPEG camera stream from the Pi.
 */

import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

import { getStreamUrl, triggerDoorbell } from "../../src/api";
import { Colors, Spacing } from "../../src/theme";

export default function LiveScreen() {
  const streamUrl = getStreamUrl();

  const handleTrigger = async () => {
    try {
      // This can take some time.
      await triggerDoorbell();
      Alert.alert("Triggered", "Doorbell button simulated!");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.streamContainer}>
        <WebView
          source={{ uri: streamUrl }}
          style={styles.stream}
          javaScriptEnabled={false}
          scrollEnabled={false}
          originWhitelist={["*"]}
          allowsInlineMediaPlayback={true}
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
  },
  stream: {
    flex: 1,
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
