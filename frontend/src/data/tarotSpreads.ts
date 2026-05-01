export type TarotSpreadPosition = {
  id: string;
  labelRu: string;
};

export type TarotSpread = {
  id: string;
  titleRu: string;
  subtitleRu: string;
  drawCount: 1 | 3;
  positions: TarotSpreadPosition[];
};

export const TAROT_SPREADS: TarotSpread[] = [
  {
    id: "one-card",
    titleRu: "Одна карта",
    subtitleRu: "Быстрый совет на ситуацию · 1 карта",
    drawCount: 1,
    positions: [{ id: "answer", labelRu: "Ответ" }],
  },
  {
    id: "three-time",
    titleRu: "Три карты",
    subtitleRu: "Прошлое · Настоящее · Будущее · 3 карты",
    drawCount: 3,
    positions: [
      { id: "past", labelRu: "Прошлое" },
      { id: "present", labelRu: "Настоящее" },
      { id: "future", labelRu: "Будущее" },
    ],
  },
  {
    id: "three-situation",
    titleRu: "Ситуация · Совет · Исход",
    subtitleRu: "Что происходит · что делать · куда ведёт путь · 3 карты",
    drawCount: 3,
    positions: [
      { id: "situation", labelRu: "Ситуация" },
      { id: "advice", labelRu: "Совет" },
      { id: "outcome", labelRu: "Исход" },
    ],
  },
  {
    id: "love-three",
    titleRu: "Любовный расклад",
    subtitleRu: "Ты · Он/она · Потенциал · 3 карты",
    drawCount: 3,
    positions: [
      { id: "you", labelRu: "Ты" },
      { id: "them", labelRu: "Он/она" },
      { id: "potential", labelRu: "Потенциал" },
    ],
  },
];

export const DEFAULT_SPREAD_ID: TarotSpread["id"] = "one-card";

export function getSpreadById(id: string): TarotSpread {
  const normalized = id === "three-card" ? "three-situation" : id;
  const found = TAROT_SPREADS.find((s) => s.id === normalized);
  return found ?? TAROT_SPREADS[0];
}
