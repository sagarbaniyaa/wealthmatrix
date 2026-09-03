export interface SuggestionTrigger {
  key: string;
  label: string;
  description: string;
  keywords: RegExp;
  linkPath: (householdId: string) => string;
}

/**
 * The "live financial intelligence panel" (spec §2) — deterministic
 * keyword matching over the running transcript, not an AI call. Kept
 * this way on purpose: it has to react while the adviser is mid-
 * conversation, so it needs to be instant and free, not a network
 * round-trip per sentence. Each trigger points at a real page already
 * built elsewhere in this platform — this panel is a router, not a new
 * source of advice.
 */
export const CALL_SUGGESTION_TRIGGERS: SuggestionTrigger[] = [
  {
    key: 'pension_transfer',
    label: 'Pension Transfer workflow',
    description: 'Client mentioned transferring a pension — open the Pension Transfer action checklist.',
    keywords: /\btransfer(ring)?\s+(my|his|her|their|the)?\s*pensions?\b|\bold pensions?\b|\bpension transfer\b|\bmove my pensions?\b/i,
    linkPath: (id) => `/advisor/households/${id}/action`,
  },
  {
    key: 'isa_gia',
    label: 'ISA/GIA wrapper options',
    description: 'Client mentioned an ISA/GIA — review tax wrapper options for this client.',
    keywords: /\bisas?\b|\bgias?\b|\bgeneral investment accounts?\b|\bstocks and shares isas?\b|\btax wrappers?\b/i,
    linkPath: (id) => `/advisor/households/${id}/cgt-analysis`,
  },
  {
    key: 'cgt_concern',
    label: 'CGT optimisation',
    description: 'Client raised a capital gains concern — open CGT & Portfolio Intelligence.',
    keywords: /\bcapital gains?\b|\bcgt\b|\btax (on|when) selling\b|\bselling shares.*tax\b/i,
    linkPath: (id) => `/advisor/households/${id}/cgt-analysis`,
  },
  {
    key: 'income_need',
    label: 'Income strategies',
    description: 'Client mentioned needing income — open retirement cashflow / income modelling.',
    keywords: /\bneed (more )?income\b|\bmonthly income\b|\bregular income\b|\bincome in retirement\b/i,
    linkPath: (id) => `/advisor/households/${id}/retirement-cashflow`,
  },
  {
    key: 'risk_concern',
    label: 'Risk explanation',
    description: 'Client expressed a risk/loss concern — open their risk profile to review and explain.',
    keywords: /\bworried about (losing|the market)\b|\bnervous about\b|\bscared (of|about) losing\b|\brisk averse\b|\btoo risky\b|\bcan'?t afford to lose\b/i,
    linkPath: (id) => `/advisor/households/${id}/fact-find`,
  },
  {
    key: 'consolidation',
    label: 'Consolidation / provider options',
    description: 'Client mentioned multiple old plans — open the Consolidation action and Provider Hub.',
    keywords: /\bconsolidat\w*\b|\bmultiple pensions\b|\bold (plans|policies)\b|\bseveral (pensions|providers)\b|\bjuggling pensions\b/i,
    linkPath: (id) => `/advisor/households/${id}/provider-hub`,
  },
  {
    key: 'retirement_planning',
    label: 'Retirement Planning',
    description: 'Client mentioned retirement — open retirement cashflow modelling.',
    keywords: /\bretire\b|\bretirement age\b|\bwhen (i|we) retire\b|\bstop working\b/i,
    linkPath: (id) => `/advisor/households/${id}/retirement-cashflow`,
  },
  {
    key: 'protection',
    label: 'Protection Review',
    description: 'Client mentioned a protection need — open the Protection Review action.',
    keywords: /\blife insurance\b|\bcritical illness\b|\bincome protection\b|\bdeath in service\b|\bprotection polic\w*\b/i,
    linkPath: (id) => `/advisor/households/${id}/action`,
  },
  {
    key: 'dfm',
    label: 'DFM & Fund Category Recommendation',
    description: 'Client mentioned wanting managed investing — open the DFM recommendation engine.',
    keywords: /\bmanaged portfolio\b|\bdiscretionary manage\w*\b|\bdfm\b|\blet someone else manage\b|\bhands[- ]off investing\b/i,
    linkPath: (id) => `/advisor/households/${id}/dfm-recommendation`,
  },
];
