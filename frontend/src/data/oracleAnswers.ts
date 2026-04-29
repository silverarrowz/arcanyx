export type OracleCategory = "yes" | "no" | "vague" | "snarky";

export const ORACLE_ANSWERS: Record<OracleCategory, string[]> = {
  yes: [
    "Да, без сомнений",
    "Всё складывается в твою пользу",
    "Судьба на твоей стороне",
  ],
  no: [
    "Определённо нет",
    "Даже не думай об этом",
    "Вселенная говорит «нет»",
  ],
  vague: ["Пока неясно", "Спроси позже", "Ответ скрыт"],
  snarky: ["Серьёзно?", "Ответ тебе не понравится", "Рискнёшь?"],
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

export function getRandomOracleAnswer(): {
  category: OracleCategory;
  answer: string;
} {
  const categories: OracleCategory[] = ["yes", "no", "vague", "snarky"];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const answers = ORACLE_ANSWERS[category];
  const answer = answers[Math.floor(Math.random() * answers.length)];
  return { category, answer };
}
