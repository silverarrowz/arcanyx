export type TarotSpreadPosition = {
  id: string;
  labelRu: string;
};

export type TarotSpread = {
  id: string;
  titleRu: string;
  subtitleRu: string;
  drawCount: 1 | 2 | 3 | 4 | 5;
  positions: TarotSpreadPosition[];
  coverUrl?: string | null;
  coverRev?: string;
  version?: string;
  sort?: number;
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
    titleRu: "Ваш путь",
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
    subtitleRu: "Вы · Он/она · Потенциал · 3 карты",
    drawCount: 3,
    positions: [
      { id: "you", labelRu: "Вы" },
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
    subtitleRu: "Где вы сейчас · куда можете вырасти · что нужно сделать · 3 карты",
    drawCount: 3,
    positions: [
      { id: "where-now", labelRu: "Где вы сейчас" },
      { id: "grow-to", labelRu: "Куда можете вырасти" },
      { id: "what-to-do", labelRu: "Что нужно сделать" },
    ],
  },
  {
    id: "where-money",
    titleRu: "На деньги",
    subtitleRu: "Скрытая возможность · что упускаете · как получить · 3 карты",
    drawCount: 3,
    positions: [
      { id: "hidden-opportunity", labelRu: "Скрытая возможность" },
      { id: "what-miss", labelRu: "Что упускаете" },
      { id: "how-get", labelRu: "Как получить" },
    ],
  },
  {
    id: "yes-no",
    titleRu: "Да / Нет",
    subtitleRu: "Конкретный ответ на закрытый вопрос · 1 карта",
    drawCount: 1,
    positions: [{ id: "answer", labelRu: "Ответ" }],
  },
  {
    id: "problem-solution",
    titleRu: "Проблема и решение",
    subtitleRu: "Истинная суть и как это исправить · 2 карты",
    drawCount: 2,
    positions: [
      { id: "problem", labelRu: "Суть проблемы" },
      { id: "solution", labelRu: "Решение" },
    ],
  },
  {
    id: "blind-spot",
    titleRu: "Слепое пятно",
    subtitleRu: "Что скрыто от вас и других · 4 карты",
    drawCount: 4,
    positions: [
      { id: "known-to-me", labelRu: "Что я знаю" },
      { id: "known-to-others", labelRu: "Что видят другие" },
      { id: "blind-spot", labelRu: "Слепое пятно" },
      { id: "potential", labelRu: "Скрытый потенциал" },
    ],
  },
  {
    id: "relationship-cross",
    titleRu: "Динамика отношений",
    subtitleRu: "Глубокий разбор связи между двумя · 5 карт",
    drawCount: 5,
    positions: [
      { id: "my-feelings", labelRu: "Ваш вклад" },
      { id: "their-feelings", labelRu: "Вклад партнёра" },
      { id: "foundation", labelRu: "Фундамент" },
      { id: "obstacle", labelRu: "Преграда" },
      { id: "future", labelRu: "Будущее" },
    ],
  },
  {
    id: "purpose",
    titleRu: "Предназначение",
    subtitleRu: "Поиск своего пути и самореализации · 5 карт",
    drawCount: 5,
    positions: [
      { id: "strength", labelRu: "Сильная сторона" },
      { id: "weakness", labelRu: "Что тормозит" },
      { id: "joy", labelRu: "Источник радости" },
      { id: "success", labelRu: "Где ваш успех" },
      { id: "mission", labelRu: "Следующий шаг" },
    ],
  },
];

export const DEFAULT_SPREAD_ID: TarotSpread["id"] = "one-card";

export function getSpreadById(id: string): TarotSpread {
  const normalized = id === "three-card" ? "three-situation" : id;
  const found = TAROT_SPREADS.find((s) => s.id === normalized);
  return found ?? TAROT_SPREADS[0];
}

export function historicalSpreadFallback(
  id: string,
  titleRu: string,
  positions: TarotSpreadPosition[],
): TarotSpread | null {
  if (positions.length < 1 || positions.length > 5) return null;
  return {
    id,
    titleRu: titleRu || "Расклад Таро",
    subtitleRu: `${positions.length} карт`,
    drawCount: positions.length as TarotSpread["drawCount"],
    positions,
  };
}
