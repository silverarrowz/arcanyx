import { TarotCard } from "./tarotCards";
import { TarotSpread } from "./tarotSpreads";

/**
 * Deterministic “reading” blurbs for MVP (no AI). Uses spread labels + drawn cards only.
 */
export function buildTarotSummaryRu(
  spread: TarotSpread,
  cards: TarotCard[],
  intentSnippet?: string,
): string {
  const trimmed = intentSnippet?.trim();
  const opener = trimmed
    ? `В теме «${trimmed.slice(0, 80)}» расклад говорит:`
    : "Расклад складывается так:";

  const first = cards[0];
  if (cards.length === 1 || spread.drawCount === 1) {
    return `${opener} ${first.nameRu} подчёркивает: ${first.short}`;
  }

  const parts = spread.positions.map((pos, i) => {
    const c = cards[i];
    if (!c) return "";
    return `в позиции «${pos.labelRu}» — ${c.nameRu}`;
  });
  const line = parts.filter(Boolean).join("; ");
  const tail =
    cards.length >= 3
      ? ` Ключевая тема переходов — ${cards[1].nameRu}: между ${cards[0].nameRu.toLowerCase()} и ${cards[2].nameRu.toLowerCase()}. Первым шагом доверься намёку ${first.nameRu}.`
      : "";

  return `${opener} ${line}.${tail}`;
}
