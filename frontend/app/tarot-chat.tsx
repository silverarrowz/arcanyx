import React from "react";
import { useLocalSearchParams } from "expo-router";
import TarotChatScreen from "../src/screens/TarotChatScreen";

export default function TarotChatRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const historyId = Array.isArray(id) ? id[0] : id;

  return <TarotChatScreen historyId={historyId} />;
}
