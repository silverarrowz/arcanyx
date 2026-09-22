import { TarotCard } from "./tarotCards";
import { TarotSpread } from "./tarotSpreads";
import {
  cardShort,
  cardTitleRu,
  isCardReversed,
} from "./tarotOrientation";

type SummaryCard = TarotCard & { reversed?: boolean };

/**
 * Deterministic “reading” blurbs for MVP (no AI). Uses spread labels + drawn cards only.
 */
export function buildTarotSummaryRu(
  spread: TarotSpread,
  cards: SummaryCard[],
  intentSnippet?: string,
): string {
  const trimmed = intentSnippet?.trim();
  const opener = trimmed
    ? `В теме «${trimmed.slice(0, 80)}» расклад говорит:`
    : "Расклад складывается так:";

  const first = cards[0];
  const firstReversed = isCardReversed(first);
  if (cards.length === 1 || spread.drawCount === 1) {
    return `${opener} ${cardTitleRu(first, firstReversed)} подчёркивает: ${cardShort(first, firstReversed)}`;
  }

  const parts = spread.positions.map((pos, i) => {
    const c = cards[i];
    if (!c) return "";
    return `в позиции «${pos.labelRu}» — ${cardTitleRu(c, isCardReversed(c))}`;
  });
  const line = parts.filter(Boolean).join("; ");
  
  let tail = "";
  if (cards.length === 2) {
    tail = ` Это взаимодействие двух сил. Точка опоры — ${cardTitleRu(first, firstReversed)}.`;
  } else if (cards.length >= 3) {
    tail = ` Ключевая тема переходов — ${cardTitleRu(cards[1], isCardReversed(cards[1]))}: между ${cardTitleRu(cards[0], isCardReversed(cards[0])).toLowerCase()} и ${cardTitleRu(cards[2], isCardReversed(cards[2])).toLowerCase()}. Первым шагом доверьтесь намёку ${cardTitleRu(first, firstReversed)}.`;
  }

  return `${opener} ${line}.${tail}`;
}
