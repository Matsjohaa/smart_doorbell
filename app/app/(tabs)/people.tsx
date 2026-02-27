/**
 * People Management screen — view, add, and remove known faces.
 */

import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import {
  Person,
  fetchPeople,
  addPerson,
  deletePerson,
  getKnownFaceUrl,
} from "../../src/api";
import { Colors, Spacing } from "../../src/theme";

export default function PeopleScreen() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  // Add-person form state
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newImageUri, setNewImageUri] = useState<string | null>(null);

  const loadPeople = useCallback(async () => {
    try {
      const data = await fetchPeople();
      setPeople(data);
    } catch (e) {
      console.warn("Failed to fetch people:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadPeople();
    }, [loadPeople])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadPeople();
  };

  // ── Pick Image ──────────────────────────────────────────────────────

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow photo library access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setNewImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow camera access.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setNewImageUri(result.assets[0].uri);
    }
  };

  // ── Add Person ──────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!newName.trim()) {
      Alert.alert("Name required", "Please enter a name for this person.");
      return;
    }
    if (!newImageUri) {
      Alert.alert("Photo required", "Please select or take a photo.");
      return;
    }

    setAdding(true);
    try {
      await addPerson(newName.trim(), newImageUri);
      setShowForm(false);
      setNewName("");
      setNewImageUri(null);
      loadPeople();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAdding(false);
    }
  };

  // ── Delete Person ───────────────────────────────────────────────────

  const handleDelete = (person: Person) => {
    Alert.alert(
      "Remove Person",
      `Remove ${person.name} from known faces?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePerson(person.id);
              setPeople((prev) => prev.filter((p) => p.id !== person.id));
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };

  // ── Render ──────────────────────────────────────────────────────────

  const renderPerson = ({ item }: { item: Person }) => (
    <View style={styles.personCard}>
      <Image
        source={{ uri: getKnownFaceUrl(item.image_path) }}
        style={styles.personImage}
      />
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{item.name}</Text>
        <Text style={styles.personDate}>
          Added {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleDelete(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={22} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <FlatList
          data={people}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPerson}
          contentContainerStyle={people.length === 0 && !showForm ? styles.centered : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            !showForm ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>No known faces</Text>
                <Text style={styles.emptySubText}>
                  Add people so the doorbell can recognise them.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            showForm ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Add New Person</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  placeholderTextColor={Colors.textSecondary}
                  value={newName}
                  onChangeText={setNewName}
                  autoCapitalize="words"
                />

                <View style={styles.imagePickerRow}>
                  <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                    <Ionicons name="images-outline" size={20} color={Colors.primary} />
                    <Text style={styles.imagePickerText}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imagePickerBtn} onPress={takePhoto}>
                    <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                    <Text style={styles.imagePickerText}>Camera</Text>
                  </TouchableOpacity>
                </View>

                {newImageUri && (
                  <Image source={{ uri: newImageUri }} style={styles.previewImage} />
                )}

                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setShowForm(false);
                      setNewName("");
                      setNewImageUri(null);
                    }}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, adding && styles.disabledBtn]}
                    onPress={handleAdd}
                    disabled={adding}
                  >
                    {adding ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null
          }
        />

        {/* Floating add button */}
        {!showForm && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setShowForm(true)}
          >
            <Ionicons name="person-add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
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
    paddingBottom: 80,
  },

  // Person card
  personCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  personImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.border,
  },
  personInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  personName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  personDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Empty state
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

  // Add form
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  imagePickerRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  imagePickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
  },
  imagePickerText: {
    color: Colors.primary,
    fontWeight: "600",
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginTop: Spacing.md,
    backgroundColor: Colors.border,
  },
  formActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  cancelText: {
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  disabledBtn: {
    opacity: 0.6,
  },
  saveText: {
    color: "#fff",
    fontWeight: "600",
  },

  // FAB
  fab: {
    position: "absolute",
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
