import { TarotCard } from "./tarotCards";
import { TAROT_REVERSALS } from "./tarotReversals";

/**
 * Chance a mixed deck yields a reversed card.
 * Close to a well-shuffled physical deck, without making reversals the default.
 */
export const REVERSED_CHANCE = 0.4;

export type OrientedTarotCard = TarotCard & { reversed: boolean };

export function rollReversed(chance: number = REVERSED_CHANCE): boolean {
  return Math.random() < chance;
}

export function withOrientation(
  card: TarotCard,
  reversed: boolean = rollReversed(),
): OrientedTarotCard {
  return { ...card, reversed };
}

export function isCardReversed(
  card: { reversed?: boolean } | null | undefined,
): boolean {
  return card?.reversed === true;
}

export function cardTitleRu(
  card: Pick<TarotCard, "nameRu">,
  reversed = false,
): string {
  return reversed ? `${card.nameRu} · перевёрнутая` : card.nameRu;
}

export function cardShort(card: TarotCard, reversed = false): string {
  if (!reversed) return card.short;
  return TAROT_REVERSALS[card.id]?.short ?? card.short;
}

export function cardDetailed(card: TarotCard, reversed = false): string {
  if (!reversed) return card.detailed;
  return TAROT_REVERSALS[card.id]?.detailed ?? card.detailed;
}
