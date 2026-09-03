/**
 * UK share-matching rules for CGT cost basis, in the order HMRC requires
 * them applied to a disposal:
 *   1. Same-day rule — shares sold are matched first against shares
 *      bought on the SAME calendar date.
 *   2. 30-day rule ("bed and breakfasting") — any of the disposal not
 *      matched above is matched next against shares bought in the
 *      FOLLOWING 30 days — the anti-avoidance rule stopping someone
 *      selling to crystallise a loss/gain and immediately buying back.
 *   3. Section 104 pool — whatever's left is matched against the
 *      running weighted-average-cost pool of everything else.
 *
 * This was a known, explicitly documented gap in the original CGT
 * engine (only step 3 was implemented) — closed here. Genuine
 * simplifications that remain, on purpose, not silently:
 *  - No support for multiple disposals ON THE SAME DAY interacting with
 *    each other's 30-day matching (each sale is matched independently,
 *    in date order, against the buy pool as it stands after earlier
 *    sales have already claimed their matches).
 *  - No handling of stock splits, rights issues, or scrip dividends,
 *    which HMRC treats as adjustments to a Section 104 pool rather than
 *    ordinary buys/sells.
 *  - Assumes every BUY/SELL transaction for a holding is present in
 *    this platform's data — a transfer-in from another platform with no
 *    recorded acquisition history still reports as a data-quality gap
 *    (see CgtIntelligenceService), not a fabricated cost basis.
 */

export interface Section104Transaction {
  type: 'buy' | 'sell';
  date: string; // ISO yyyy-mm-dd
  quantity: number;
  amountBase: number; // buy: total cost; sell: not used by this function (only quantity/date matter for cost-basis-of-remainder purposes)
}

export interface Section104Match {
  saleDate: string;
  quantity: number;
  rule: 'same-day' | '30-day' | 'section-104';
}

export interface Section104Result {
  poolQuantity: number;
  poolCost: number;
  matches: Section104Match[];
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function computeSection104Pool(transactions: Section104Transaction[]): Section104Result {
  const items = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      ...t,
      unitCost: t.type === 'buy' && t.quantity > 0 ? t.amountBase / t.quantity : 0,
      remaining: t.quantity, // quantity not yet claimed by same-day/30-day matching
    }));

  const buys = items.filter((i) => i.type === 'buy');
  const sells = items.filter((i) => i.type === 'sell');
  const matches: Section104Match[] = [];

  // Steps 1 & 2 — same-day, then 30-day — remove quantity from specific
  // buy lots before they're ever eligible for the general pool.
  for (const sell of sells) {
    const sameDay = buys.filter((b) => b.date === sell.date && b.remaining > 0);
    for (const buy of sameDay) {
      if (sell.remaining <= 0) break;
      const matched = Math.min(sell.remaining, buy.remaining);
      buy.remaining -= matched;
      sell.remaining -= matched;
      matches.push({ saleDate: sell.date, quantity: matched, rule: 'same-day' });
    }

    if (sell.remaining > 0) {
      const within30 = buys
        .filter((b) => b.remaining > 0 && daysBetween(sell.date, b.date) > 0 && daysBetween(sell.date, b.date) <= 30)
        .sort((a, b) => a.date.localeCompare(b.date));
      for (const buy of within30) {
        if (sell.remaining <= 0) break;
        const matched = Math.min(sell.remaining, buy.remaining);
        buy.remaining -= matched;
        sell.remaining -= matched;
        matches.push({ saleDate: sell.date, quantity: matched, rule: '30-day' });
      }
    }
    // Whatever's left in sell.remaining falls through to the pool walk below.
  }

  // Step 3 — walk chronologically; each buy contributes only its
  // POST-matching remaining quantity/cost to the pool, and each sell
  // draws down only its POST-matching remaining quantity, at the
  // pool's running average cost.
  let poolQuantity = 0;
  let poolCost = 0;
  for (const item of items) {
    if (item.type === 'buy') {
      if (item.remaining > 0) {
        poolQuantity += item.remaining;
        poolCost += item.remaining * item.unitCost;
      }
    } else if (item.remaining > 0 && poolQuantity > 0) {
      const avgCost = poolCost / poolQuantity;
      const soldQty = Math.min(item.remaining, poolQuantity);
      poolCost -= avgCost * soldQty;
      poolQuantity -= soldQty;
      matches.push({ saleDate: item.date, quantity: soldQty, rule: 'section-104' });
    }
  }

  return { poolQuantity, poolCost, matches };
}
