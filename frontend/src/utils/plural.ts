/**
 * Russian plural form for a count.
 *
 * @param forms `[1, 2, 5]` — e.g. `["запись", "записи", "записей"]`.
 */
export function plural(count: number, forms: [string, string, string]): string {
  const n = Math.abs(count) % 100;
  if (n >= 11 && n <= 14) return forms[2];
  const last = n % 10;
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const MONTHS_NOMINATIVE = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

export function monthGenitive(date: Date): string {
  return MONTHS_GENITIVE[date.getMonth()];
}

export function monthNominative(date: Date): string {
  return MONTHS_NOMINATIVE[date.getMonth()];
}
