/**
 * Notifications screen — shows the event log from the doorbell.
 * Unread events are highlighted. Tapping an event shows the captured image.
 */

import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  DoorbellEvent,
  fetchEvents,
  markEventSeen,
  getCaptureUrl,
} from "../../src/api";
import { Colors, Spacing } from "../../src/theme";

export default function NotificationsScreen() {
  const [events, setEvents] = useState<DoorbellEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<DoorbellEvent | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      const data = await fetchEvents();
      setEvents(data);
    } catch (e) {
      console.warn("Failed to fetch events:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload events every time the tab gains focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadEvents();
    }, [loadEvents])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handlePress = async (event: DoorbellEvent) => {
    setSelectedEvent(event);
    if (!event.seen) {
      await markEventSeen(event.id);
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, seen: 1 } : e))
      );
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const renderEvent = ({ item }: { item: DoorbellEvent }) => {
    const isUnseen = !item.seen;
    const isUnknown =
      !item.person_name || item.person_name === "Unknown" || item.person_name === "No face detected";

    return (
      <TouchableOpacity
        style={[
          styles.eventCard,
          isUnseen && styles.unseenCard,
        ]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.eventIcon}>
          <Ionicons
            name={isUnknown ? "help-circle" : "person-circle"}
            size={36}
            color={isUnknown ? Colors.warning : Colors.success}
          />
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventName}>
            {item.person_name || "Unknown"}
          </Text>
          <Text style={styles.eventTime}>{formatTime(item.timestamp)}</Text>
          {item.confidence != null && (
            <Text style={styles.eventConfidence}>
              Confidence: {(item.confidence * 100).toFixed(1)}%
            </Text>
          )}
        </View>
        {isUnseen && <View style={styles.unseenDot} />}
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderEvent}
        contentContainerStyle={events.length === 0 ? styles.centered : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No events yet</Text>
            <Text style={styles.emptySubText}>
              Events will appear here when the doorbell is pressed.
            </Text>
          </View>
        }
      />

      {/* Image modal */}
      <Modal
        visible={selectedEvent != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setSelectedEvent(null)}
            >
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>

            {selectedEvent && (
              <>
                <Image
                  source={{ uri: getCaptureUrl(selectedEvent.image_path) }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
                <View style={styles.modalInfo}>
                  <Text style={styles.modalName}>
                    {selectedEvent.person_name || "Unknown"}
                  </Text>
                  <Text style={styles.modalTime}>
                    {formatTime(selectedEvent.timestamp)}
                  </Text>
                  {selectedEvent.confidence != null && (
                    <Text style={styles.modalConfidence}>
                      Confidence: {(selectedEvent.confidence * 100).toFixed(1)}%
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    padding: Spacing.sm,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unseenCard: {
    backgroundColor: Colors.unseen,
    borderColor: Colors.primary,
  },
  eventIcon: {
    marginRight: Spacing.md,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  eventTime: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  eventConfidence: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  unseenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginRight: Spacing.sm,
  },
  empty: {
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySubText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxHeight: "80%",
    alignItems: "center",
  },
  modalClose: {
    alignSelf: "flex-end",
    marginBottom: Spacing.sm,
  },
  modalImage: {
    width: "100%",
    height: 350,
    borderRadius: 12,
    backgroundColor: "#111",
  },
  modalInfo: {
    marginTop: Spacing.md,
    alignItems: "center",
  },
  modalName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  modalTime: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 4,
  },
  modalConfidence: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 2,
  },
});
