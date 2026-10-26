import { isNatural, isWild } from './cards';
import { MAX_WILDS } from './rules';
import type { Card, Meld, MeldGroup } from './types';

/**
 * Teilt eine gemischte Kartenauswahl in Meldungen auf: natürliche Karten nach Rang,
 * Wildcards dorthin, wo sie fehlen (sonst zur größten Meldung). Gleiche Ränge wie bestehende
 * Meldungen werden von der Engine automatisch angelegt.
 * Liefert eine Fehlermeldung, wenn nicht klar ist, wohin Wildcards sollen.
 */
export function autoGroup(cards: Card[], melds: Meld[]): MeldGroup[] | string {
  const wilds = cards.filter(isWild);
  const byRank = new Map<number, Card[]>();
  for (const c of cards.filter(isNatural)) byRank.set(c.rank, [...(byRank.get(c.rank) ?? []), c]);

  const groups = [...byRank].map(([rank, cs]) => {
    const existing = melds.find((m) => m.rank === rank);
    const size = (existing?.cards.length ?? 0) + cs.length;
    const wildsIn = existing?.cards.filter(isWild).length ?? 0;
    return { rank, cards: [...cs], size, wildsIn, added: 0 };
  });

  if (groups.length === 0) {
    if (wilds.length === 0) return [];
    return 'Tippe auf die Meldung, an die die Wildcards sollen.';
  }

  const room = (g: (typeof groups)[number]) => (g.rank === 3 ? 0 : MAX_WILDS - g.wildsIn - g.added);
  const pool = [...wilds];
  // Zuerst Meldungen auffüllen, denen noch Karten bis zur Mindestgröße fehlen.
  for (const g of groups) {
    while (g.size + g.added < 3 && room(g) > 0 && pool.length > 0) {
      g.cards.push(pool.shift()!);
      g.added++;
    }
  }
  // Übrige Wildcards zur größten Meldung, die noch Platz hat.
  while (pool.length > 0) {
    const target = [...groups].filter((g) => room(g) > 0).sort((a, b) => b.size + b.added - (a.size + a.added))[0];
    if (!target) return `Höchstens ${MAX_WILDS} Wildcards pro Meldung.`;
    target.cards.push(pool.shift()!);
    target.added++;
  }

  return groups.map((g) => ({ cardIds: g.cards.map((c) => c.id) }));
}
