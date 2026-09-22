import React from "react";
import { useLocalSearchParams } from "expo-router";
import OracleScreen from "../src/screens/OracleScreen";

export default function OracleReadingRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const historyId = Array.isArray(id) ? id[0] : id;

  return <OracleScreen historyId={historyId} />;
}
