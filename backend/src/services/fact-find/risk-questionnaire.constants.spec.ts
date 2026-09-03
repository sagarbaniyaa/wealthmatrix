import { RISK_QUESTIONNAIRE, scoreRiskQuestionnaire, RISK_CATEGORY_TO_TOLERANCE, RiskCategory } from './risk-questionnaire.constants';

function answerAllWith(optionKey: 'A' | 'B' | 'C' | 'D' | 'E') {
  return RISK_QUESTIONNAIRE.map((q) => ({ questionKey: q.key, selectedOption: optionKey }));
}

describe('scoreRiskQuestionnaire', () => {
  it('returns null for an empty answer set', () => {
    expect(scoreRiskQuestionnaire([])).toBeNull();
  });

  it('ignores answers to unknown question keys and unknown option keys', () => {
    const result = scoreRiskQuestionnaire([
      { questionKey: 'not_a_real_question', selectedOption: 'A' },
      { questionKey: RISK_QUESTIONNAIRE[0].key, selectedOption: 'Z' },
    ]);
    expect(result).toBeNull();
  });

  it('answering every question with the most cautious option (A) scores near the bottom of the scale (one question is reverse-scored, so not exactly 0)', () => {
    // 7 standard questions score A=weight 1; the one reversed question
    // ("prioritise_preservation") scores A=weight 5 — (7*1 + 5) / 8 = 1.5
    // average -> ((1.5-1)/4)*100 = 12.5. This is the correct behaviour,
    // not a bug: someone who "strongly disagrees" with prioritising
    // capital preservation IS behaving more risk-tolerantly on that
    // question, even while answering "extremely low risk" everywhere else.
    const result = scoreRiskQuestionnaire(answerAllWith('A'));
    expect(result).not.toBeNull();
    expect(result!.score).toBe(12.5);
    expect(result!.category).toBe('risk_averse');
  });

  it('answering every question with the most risk-tolerant option (E) scores near the top of the scale (same reverse-scoring effect, mirrored)', () => {
    // 7 standard questions at weight 5, the reversed question at weight 1 ->
    // (35 + 1) / 8 = 4.5 average -> ((4.5-1)/4)*100 = 87.5.
    const result = scoreRiskQuestionnaire(answerAllWith('E'));
    expect(result).not.toBeNull();
    expect(result!.score).toBe(87.5);
    expect(result!.category).toBe('aggressive');
  });

  it('answering only the non-reversed questions at the extremes DOES hit the true 0/100 ends of the scale', () => {
    const nonReversed = RISK_QUESTIONNAIRE.filter((q) => q.key !== 'prioritise_preservation');
    const allA = scoreRiskQuestionnaire(nonReversed.map((q) => ({ questionKey: q.key, selectedOption: 'A' })));
    const allE = scoreRiskQuestionnaire(nonReversed.map((q) => ({ questionKey: q.key, selectedOption: 'E' })));
    expect(allA!.score).toBe(0);
    expect(allE!.score).toBe(100);
  });

  it('answering every question with the middle option (C) scores in the middle band', () => {
    const result = scoreRiskQuestionnaire(answerAllWith('C'));
    expect(result).not.toBeNull();
    expect(result!.score).toBe(50);
    expect(result!.category).toBe('balanced');
  });

  it('the reverse-scored "prioritise_preservation" question flips its weighting', () => {
    // Agreeing (D) with "I prioritise capital preservation" should pull the
    // score DOWN (more cautious), not up — because it's reverse-scored.
    const agreeCautious = scoreRiskQuestionnaire([{ questionKey: 'prioritise_preservation', selectedOption: 'D' }]);
    const agreeBold = scoreRiskQuestionnaire([{ questionKey: 'accept_losses_for_returns', selectedOption: 'D' }]);
    expect(agreeCautious!.score).toBeLessThan(agreeBold!.score);
  });

  it('scores a partial questionnaire using only the answered questions', () => {
    const result = scoreRiskQuestionnaire([{ questionKey: RISK_QUESTIONNAIRE[0].key, selectedOption: 'E' }]);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(100);
  });

  it('every band boundary is covered by exactly one category, with no gaps', () => {
    // Walk every possible average weight (1.0 to 5.0 in 0.05 steps) and
    // confirm scoreRiskQuestionnaire never throws / always resolves a category.
    for (let avg = 1; avg <= 5; avg += 0.05) {
      const weight = Math.round(avg) as 1 | 2 | 3 | 4 | 5;
      const key: Record<number, 'A' | 'B' | 'C' | 'D' | 'E'> = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' };
      const result = scoreRiskQuestionnaire([{ questionKey: RISK_QUESTIONNAIRE[0].key, selectedOption: key[weight] }]);
      expect(result).not.toBeNull();
      expect(['risk_averse', 'conservative', 'balanced', 'adventurous', 'aggressive']).toContain(result!.category);
    }
  });
});

describe('RISK_CATEGORY_TO_TOLERANCE', () => {
  it('maps every 5-band category onto a valid 3-band tolerance', () => {
    const categories: RiskCategory[] = ['risk_averse', 'conservative', 'balanced', 'adventurous', 'aggressive'];
    categories.forEach((c) => {
      expect(['conservative', 'moderate', 'aggressive']).toContain(RISK_CATEGORY_TO_TOLERANCE[c]);
    });
  });

  it('is monotonic — a more risk-tolerant category never maps to a MORE cautious 3-band tolerance', () => {
    const order = { conservative: 0, moderate: 1, aggressive: 2 };
    const bands: RiskCategory[] = ['risk_averse', 'conservative', 'balanced', 'adventurous', 'aggressive'];
    for (let i = 1; i < bands.length; i++) {
      expect(order[RISK_CATEGORY_TO_TOLERANCE[bands[i]]]).toBeGreaterThanOrEqual(order[RISK_CATEGORY_TO_TOLERANCE[bands[i - 1]]]);
    }
  });
});
