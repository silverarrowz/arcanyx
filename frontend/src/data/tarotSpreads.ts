export type TarotSpreadPosition = {
  id: string;
  labelRu: string;
};

export type TarotSpread = {
  id: "one-card" | "three-card" | string;
  titleRu: string;
  subtitleRu: string;
  drawCount: 1 | 3;
  positions: TarotSpreadPosition[];
};

export const TAROT_SPREADS: TarotSpread[] = [
  {
    id: "one-card",
    titleRu: "Одна карта",
    subtitleRu: "Короткий ответ на ситуацию",
    drawCount: 1,
    positions: [{ id: "card", labelRu: "Карта дня" }],
  },
  {
    id: "three-card",
    titleRu: "Три карты",
    subtitleRu: "Ситуация · Совет · Исход",
    drawCount: 3,
    positions: [
      { id: "situation", labelRu: "Ситуация" },
      { id: "advice", labelRu: "Совет" },
      { id: "outcome", labelRu: "Исход" },
    ],
  },
];

export const DEFAULT_SPREAD_ID: TarotSpread["id"] = "one-card";

export function getSpreadById(id: string): TarotSpread {
  return TAROT_SPREADS.find((s) => s.id === id) ?? TAROT_SPREADS[0];
}
