export type OracleCategory = "yes" | "no" | "vague" | "snarky";
export type OracleSource = "universe" | "innerSelf" | "shadow";

export type OracleSourceMeta = {
  id: OracleSource;
  label: string;
  shortLabel: string;
  subtitle: string;
  color: string;
  aura: string;
};

export const ORACLE_SOURCE_META: Record<OracleSource, OracleSourceMeta> = {
  universe: {
    id: "universe",
    label: "Вселенная",
    shortLabel: "Вселенная",
    subtitle: "знаки, совпадения, большая картина",
    color: "#B5A9DC",
    aura: "#8B5CF6",
  },
  innerSelf: {
    id: "innerSelf",
    label: "Внутреннее Я",
    shortLabel: "Я",
    subtitle: "интуиция, честность, тихое знание",
    color: "#7DD3FC",
    aura: "#38BDF8",
  },
  shadow: {
    id: "shadow",
    label: "Тень",
    shortLabel: "Тень",
    subtitle: "скрытые мотивы, страхи и правда без сахара",
    color: "#F4A349",
    aura: "#F4A349",
  },
};

export const ORACLE_SOURCES: OracleSourceMeta[] = [
  ORACLE_SOURCE_META.universe,
  ORACLE_SOURCE_META.innerSelf,
  ORACLE_SOURCE_META.shadow,
];

export const ORACLE_ANSWERS: Record<
  OracleSource,
  Record<OracleCategory, string[]>
> = {
  universe: {
    yes: [
      "Да, без сомнений",
      "Всё складывается в твою пользу",
      "Судьба на твоей стороне",
      "Знак уже рядом — доверься направлению",
    ],
    no: [
      "Определённо нет",
      "Вселенная закрывает эту дверь",
      "Сейчас это уведёт тебя в сторону",
      "Не дави: поток сопротивляется",
    ],
    vague: [
      "Пока неясно",
      "Спроси позже",
      "Ответ скрыт за следующим событием",
      "Нужно ещё одно совпадение, чтобы картина сложилась",
    ],
    snarky: [
      "Серьёзно?",
      "Вселенная молчит, но очень выразительно",
      "Ты уже видела знак и решила его не заметить",
      "Рискнёшь спорить с небом?",
    ],
  },
  innerSelf: {
    yes: [
      "Да — ты уже знаешь это внутри",
      "Тело расслабляется, когда ты думаешь об этом",
      "Выбирай то, где становится больше воздуха",
      "Твоя интуиция говорит: можно",
    ],
    no: [
      "Нет — это звучит не как твоё",
      "Внутри уже есть сопротивление, послушай его",
      "Не соглашайся только из страха потерять шанс",
      "Ответ нет, даже если разум торгуется",
    ],
    vague: [
      "Сначала отдели своё желание от чужих ожиданий",
      "Ответ проявится, когда ты перестанешь себя уговаривать",
      "Тебе нужно больше тишины, не больше советов",
      "Пока внутри слишком много шума",
    ],
    snarky: [
      "Ты спрашиваешь, потому что не хочешь признавать ответ",
      "Внутреннее Я закатило глаза",
      "Не называй тревогу интуицией",
      "Попробуй спросить честнее",
    ],
  },
  shadow: {
    yes: [
      "Да, но признай, чего ты на самом деле хочешь",
      "Да — если готова встретиться с последствиями",
      "Это сработает, когда ты перестанешь играть роль",
      "Да, но сила здесь в честности, не в контроле",
    ],
    no: [
      "Нет. Это попытка убежать от неприятного чувства",
      "Не выбирай это из голода по подтверждению",
      "Тень говорит: ты путаешь желание и зависимость",
      "Нет, пока мотив спрятан от тебя самой",
    ],
    vague: [
      "Сначала назови страх по имени",
      "Ответ спрятан в том, чего ты избегаешь",
      "Там есть правда, но она ещё под защитой",
      "Пока вопрос задан не из центра, а из раны",
    ],
    snarky: [
      "Тень аплодирует твоей способности всё усложнить",
      "Ты уверена, что хочешь правду, а не красивую легенду?",
      "Ответ неприятный, зато полезный",
      "Сначала сними корону жертвы, потом спросим ещё раз",
    ],
  },
};

export const CATEGORY_META: Record<
  OracleCategory,
  { label: string; color: string }
> = {
  yes: { label: "Утверждение", color: "#10B981" },
  no: { label: "Отрицание", color: "#EF4444" },
  vague: { label: "Туман", color: "#9CA3AF" },
  snarky: { label: "С характером", color: "#D4AF37" },
};

export function getRandomOracleAnswer(source: OracleSource = "universe"): {
  category: OracleCategory;
  answer: string;
  source: OracleSource;
} {
  const categories: OracleCategory[] = ["yes", "no", "vague", "snarky"];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const answers = ORACLE_ANSWERS[source][category];
  const answer = answers[Math.floor(Math.random() * answers.length)];
  return { category, answer, source };
}
