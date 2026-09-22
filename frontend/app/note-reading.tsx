import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Check, Pencil, X } from "lucide-react-native";
import CosmicBackground from "../src/components/CosmicBackground";
import { useHistory } from "../src/context/HistoryContext";
import { theme } from "../src/theme";

const NOTE_BG = require("../assets/home/chrome-aff.jpg");

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NoteReadingScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const noteId = Array.isArray(id) ? id[0] : id;
  const { items, updateItem } = useHistory();
  const [isEditing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const note = useMemo(
    () => items.find((item) => item.id === noteId && item.type === "note") ?? null,
    [items, noteId],
  );

  const artHeight = Math.ceil(windowWidth * 1.28);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/diary");
  };

  const beginEditing = () => {
    if (!note) return;
    Haptics.selectionAsync().catch(() => {});
    setDraft(note.answer);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft("");
    setEditing(false);
  };

  const saveEditing = () => {
    const text = draft.trim();
    if (!note || !text) return;
    updateItem(note.id, { answer: text });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setDraft("");
    setEditing(false);
  };

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <Image
        source={NOTE_BG}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: windowWidth,
          height: artHeight,
        }}
        contentFit="cover"
        contentPosition="center"
        cachePolicy="memory-disk"
        pointerEvents="none"
      />
      <LinearGradient
        colors={[theme.colors.bg, "rgba(18,16,34,0.7)", "rgba(18,16,34,0.28)"]}
        locations={[0, 0.38, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: windowWidth,
          height: artHeight,
        }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(18,16,34,0.12)", "rgba(18,16,34,0.62)", theme.colors.bg]}
        locations={[0, 0.58, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: windowWidth,
          height: artHeight,
        }}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Text style={styles.date} numberOfLines={1}>
            {note ? formatDate(note.date) : ""}
          </Text>
          <View style={styles.topActions}>
            {note && !isEditing ? (
              <Pressable
                onPress={beginEditing}
                hitSlop={10}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Редактировать заметку"
                testID="note-reading-edit"
              >
                <Pencil color={theme.colors.gold} size={16} strokeWidth={1.8} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleBack}
              hitSlop={10}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Закрыть заметку"
            >
              <X color={theme.colors.text} size={20} strokeWidth={1.8} />
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {!note ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Заметка не найдена</Text>
              <Pressable onPress={handleBack} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Вернуться в дневник</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
              >
                {isEditing ? (
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    multiline
                    autoFocus
                    textAlignVertical="top"
                    style={styles.input}
                    placeholder="Что у вас на душе?"
                    placeholderTextColor={theme.colors.textMuted}
                    testID="note-reading-input"
                  />
                ) : (
                  <Text style={styles.noteText} selectable>
                    {note.answer}
                  </Text>
                )}
              </ScrollView>

              {isEditing ? (
                <View style={styles.editActions}>
                  <Pressable onPress={cancelEditing} style={styles.cancelButton}>
                    <Text style={styles.cancelText}>Отмена</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveEditing}
                    disabled={!draft.trim()}
                    style={({ pressed }) => [
                      styles.saveButton,
                      !draft.trim() && styles.saveButtonDisabled,
                      pressed && { opacity: 0.88 },
                    ]}
                    testID="note-reading-save"
                  >
                    <LinearGradient
                      colors={theme.gradients.primaryCta}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.saveGradient}
                    >
                      <Check color="#FFF7EA" size={17} strokeWidth={2} />
                      <Text style={styles.saveText}>Сохранить</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 12,
  },
  date: {
    flex: 1,
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(35,31,58,0.65)",
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  content: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 48,
    flexGrow: 1,
  },
  noteText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 28,
    lineHeight: 40,
  },
  input: {
    minHeight: 280,
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 28,
    lineHeight: 40,
    padding: 0,
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 10,
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  cancelText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
  saveButton: {
    flex: 1.35,
    borderRadius: 999,
    overflow: "hidden",
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveGradient: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 16,
  },
  saveText: {
    color: "#FFF7EA",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 24,
  },
  emptyButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  emptyButtonText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
  },
});
