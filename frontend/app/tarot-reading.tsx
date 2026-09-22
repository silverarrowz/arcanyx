import React from "react";
import { useLocalSearchParams } from "expo-router";
import TarotScreen from "../src/screens/TarotScreen";

export default function TarotReadingRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const historyId = Array.isArray(id) ? id[0] : id;

  return <TarotScreen historyId={historyId} />;
}
