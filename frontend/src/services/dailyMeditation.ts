import type { Meditation } from "./meditations";

/** Части суток совпадают с приветствием на главной (`greetingForHour`). */
export type DaySlot = "morning" | "day" | "evening" | "night";

/**
 * Основы слов, по которым медитация относится к части суток.
 * Сверяются с тегами из админки и заголовком, поэтому новые медитации
 * попадают в нужное время без правок кода — достаточно тега «утро», «вечер» и т.п.
 */
const SLOT_STEMS: Record<DaySlot, string[]> = {
  morning: ["утр", "пробужд", "рассвет", "бодрост", "зарядк", "подъем"],
  day: ["дневн", "полдень", "фокус", "концентрац", "продуктивн", "перерыв"],
  evening: ["вечер", "закат", "расслабл", "разгруз", "успокоен", "отдых"],
  night: ["ноч", "сон", "сны", "снов", "засып", "бессонниц", "дремот"],
};

/** Если для текущей части суток нет медитаций, берём из соседней. */
const ADJACENT_SLOTS: Record<DaySlot, DaySlot[]> = {
  morning: ["day"],
  day: ["morning", "evening"],
  evening: ["night", "day"],
  night: ["evening"],
};

/** Сдвиг, чтобы утром и вечером одного дня выпадали разные практики. */
const SLOT_OFFSET: Record<DaySlot, number> = {
  morning: 0,
  day: 1,
  evening: 2,
  night: 3,
};

export function daySlotForHour(hour: number): DaySlot {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "day";
  if (hour >= 17 && hour < 23) return "evening";
  return "night";
}

export function currentDaySlot(now: Date = new Date()): DaySlot {
  return daySlotForHour(now.getHours());
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е");
}

function words(values: string[]): string[] {
  return values
    .flatMap((value) => normalize(value).split(/[^a-zа-я0-9]+/))
    .filter(Boolean);
}

/** Части суток, к которым подходит медитация. Пустое множество — подходит всегда. */
function slotsOf(item: Meditation): Set<DaySlot> {
  const tokens = words([...(item.tags ?? []), item.title ?? ""]);
  const slots = new Set<DaySlot>();
  (Object.keys(SLOT_STEMS) as DaySlot[]).forEach((slot) => {
    const matched = SLOT_STEMS[slot].some((stem) =>
      tokens.some((token) => token.startsWith(stem)),
    );
    if (matched) slots.add(slot);
  });
  return slots;
}

/** Номер дня от эпохи: соседние дни дают соседние индексы, поэтому список ротируется. */
function dayIndex(dayKey: string): number {
  const [year, month, date] = dayKey.split("-").map(Number);
  if (!year || !month || !date) return 0;
  return Math.floor(Date.UTC(year, month - 1, date) / 86_400_000);
}

/**
 * Медитация дня: одна и та же в течение части суток, следующий день — следующая
 * по кругу, так что практики не повторяются, пока не кончится подборка.
 */
export function pickDailyMeditation(
  items: Meditation[],
  dayKey: string,
  slot: DaySlot,
): Meditation | null {
  const playable = items.filter((item) => item.hasAudio || item.audioFile);
  if (playable.length === 0) return null;

  const withCover = playable.filter((item) => item.hasCover || item.coverFile);
  const pool = withCover.length > 0 ? withCover : playable;
  const sorted = [...pool].sort((a, b) => a.slug.localeCompare(b.slug));
  const slotsBySlug = new Map(sorted.map((item) => [item.slug, slotsOf(item)]));
  const slotsFor = (item: Meditation) =>
    slotsBySlug.get(item.slug) ?? new Set<DaySlot>();

  const tiers: Meditation[][] = [
    sorted.filter((item) => slotsFor(item).has(slot)),
    sorted.filter((item) => slotsFor(item).size === 0),
    sorted.filter((item) =>
      ADJACENT_SLOTS[slot].some((near) => slotsFor(item).has(near)),
    ),
    sorted,
  ];
  const candidates = tiers.find((tier) => tier.length > 0) ?? sorted;
  const index =
    (((dayIndex(dayKey) + SLOT_OFFSET[slot]) % candidates.length) +
      candidates.length) %
    candidates.length;
  return candidates[index];
}
