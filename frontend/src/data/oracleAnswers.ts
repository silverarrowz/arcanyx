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
      "Судьба на вашей стороне",
      "Знак уже рядом — доверьтесь направлению",
    ],
    no: [
      "Определённо нет",
      "Вселенная закрывает эту дверь",
      "Сейчас это уведёт вас в сторону",
      "Не давите: поток сопротивляется",
    ],
    vague: [
      "Пока неясно",
      "Спросите позже",
      "Ответ скрыт за следующим событием",
      "Нужно ещё одно совпадение, чтобы картина сложилась",
    ],
    snarky: [
      "Серьёзно?",
      "Вселенная молчит, но очень выразительно",
      "Вы уже видели знак и решили его не заметить",
      "Рискнёте спорить с небом?",
    ],
  },
  innerSelf: {
    yes: [
      "Да — вы уже знаете это внутри",
      "Тело расслабляется, когда вы думаете об этом",
      "Выбирайте то, где становится больше воздуха",
      "Ваша интуиция говорит: можно",
    ],
    no: [
      "Нет — это звучит не как ваше",
      "Внутри уже есть сопротивление, послушайте его",
      "Не соглашайтесь только из страха потерять шанс",
      "Ответ нет, даже если разум торгуется",
    ],
    vague: [
      "Сначала отделите своё желание от чужих ожиданий",
      "Ответ проявится, когда вы перестанете себя уговаривать",
      "Вам нужно больше тишины, не больше советов",
      "Пока внутри слишком много шума",
    ],
    snarky: [
      "Вы спрашиваете, потому что не хотите признавать ответ",
      "Внутреннее Я закатило глаза",
      "Не называйте тревогу интуицией",
      "Попробуйте спросить честнее",
    ],
  },
  shadow: {
    yes: [
      "Да, но признайте, чего вы на самом деле хотите",
      "Да — если готовы встретиться с последствиями",
      "Это сработает, когда вы перестанете играть роль",
      "Да, но сила здесь в честности, не в контроле",
    ],
    no: [
      "Нет. Это попытка убежать от неприятного чувства",
      "Не выбирайте лишь из жажды чужого одобрения",
      "Тень говорит: вы путаете желание и зависимость",
      "Нет, пока мотив спрятан от вас самих",
    ],
    vague: [
      "Сначала назовите страх по имени",
      "Ответ спрятан в том, чего вы избегаете",
      "Там есть правда, но она ещё под защитой",
      "Пока вопрос задан не из центра, а из раны",
    ],
    snarky: [
      "Тень аплодирует вашей способности всё усложнить",
      "Вы уверена, что хотите правду, а не красивую легенду?",
      "Честный ответ вам не понравится. Справитесь?",
      "Сначала снимите корону жертвы, потом спросим ещё раз",
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
