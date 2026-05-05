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
    titleRu: "Карта момента",
    subtitleRu: "Быстрый совет на ситуацию · 1 карта",
    drawCount: 1,
    positions: [{ id: "answer", labelRu: "Ответ" }],
  },
  {
    id: "three-time",
    titleRu: "Твой путь",
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
    titleRu: "Расклад на отношения",
    subtitleRu: "Ты · Он/она · Потенциал · 3 карты",
    drawCount: 3,
    positions: [
      { id: "you", labelRu: "Ты" },
      { id: "them", labelRu: "Он/она" },
      { id: "potential", labelRu: "Потенциал" },
    ],
  },
  {
    id: "thoughts",
    titleRu: "Мысли человека",
    subtitleRu: "Что он/она думает · чувствует · скрывает · 3 карты",
    drawCount: 3,
    positions: [
      { id: "thoughts", labelRu: "Мысли" },
      { id: "feelings", labelRu: "Чувства" },
      { id: "hidden", labelRu: "Скрывает" },
    ],
  },
  {
    id: "choice",
    titleRu: "Выбор пути",
    subtitleRu: "Путь A · Путь B · совет · 3 карты",
    drawCount: 3,
    positions: [
      { id: "path-a", labelRu: "Путь A" },
      { id: "path-b", labelRu: "Путь B" },
      { id: "advice", labelRu: "Совет" },
    ],
  },
  {
    id: "career-growth",
    titleRu: "Рост в карьере",
    subtitleRu: "Где ты сейчас · куда можешь вырасти · что нужно сделать · 3 карты",
    drawCount: 3,
    positions: [
      { id: "where-now", labelRu: "Где ты сейчас" },
      { id: "grow-to", labelRu: "Куда можешь вырасти" },
      { id: "what-to-do", labelRu: "Что нужно сделать" },
    ],
  },
  {
    id: "where-money",
    titleRu: "На деньги",
    subtitleRu: "Скрытая возможность · что упускаешь · как получить · 3 карты",
    drawCount: 3,
    positions: [
      { id: "hidden-opportunity", labelRu: "Скрытая возможность" },
      { id: "what-miss", labelRu: "Что упускаешь" },
      { id: "how-get", labelRu: "Как получить" },
    ],
  },

];

export const DEFAULT_SPREAD_ID: TarotSpread["id"] = "one-card";

export function getSpreadById(id: string): TarotSpread {
  const normalized = id === "three-card" ? "three-situation" : id;
  const found = TAROT_SPREADS.find((s) => s.id === normalized);
  return found ?? TAROT_SPREADS[0];
}
