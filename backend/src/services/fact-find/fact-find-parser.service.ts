import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';

export interface ParsedFactFind {
  reviewPurposes?: { selected?: string[]; otherDetails?: string; reviewNotes?: string };
  personalCircumstances?: Record<string, unknown>;
  incomeExpenditure?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  liabilities?: Record<string, unknown>;
  insurance?: Record<string, unknown>;
  investmentQuestions?: Record<string, unknown>;
  retirementQuestions?: Record<string, unknown>;
  lifeEvents?: string[];
  taxConcerns?: string;
  riskBehaviourNotes?: string;
  gaps: string[];
}

/**
 * Turns free-text meeting notes/a call transcript into a pre-filled draft
 * of the Fact Find's more "speech-derivable" sections — never the
 * Attitude-to-Risk questionnaire or the declaration, both of which need
 * the client's own direct answers/signature, not an inference from a
 * conversation. Anything the adviser didn't actually say is left out
 * (via `gaps`) rather than guessed, same discipline as every other AI
 * feature in this codebase.
 */
@Injectable()
export class FactFindParserService {
  private readonly logger = new Logger(FactFindParserService.name);

  constructor(private readonly claude: ClaudeClientService) {}

  async parse(notes: string): Promise<{ parsed: ParsedFactFind | null; error: string | null }> {
    try {
      const parsed = await this.claude.completeJSON<ParsedFactFind>({
        system:
          'You are an assistant for a UK financial adviser, extracting structured Fact Find data from raw ' +
          'meeting notes or a call transcript. Only include information the notes actually state or clearly ' +
          'imply — never invent a figure, date, or name that isn\'t there. Respond with ONLY a JSON object (no ' +
          'prose, no markdown fences) matching this shape, omitting any key where the notes say nothing relevant ' +
          '(do not include empty placeholders):\n' +
          '{\n' +
          '  "reviewPurposes": { "selected": string[] (pick from: "Annual review of current arrangements", ' +
          '"Review of existing pension plans", "Establish a new pension/investment plan", "Retirement planning ' +
          'review", "Inheritance planning review", "Review/establish protection arrangements", "Consolidate ' +
          'investments with a single provider", "Other"), "otherDetails": string, "reviewNotes": string },\n' +
          '  "personalCircumstances": { "healthStatus": "good"|"bad"|"other", "smoker": boolean, ' +
          '"maritalStatus": "single"|"married"|"divorced"|"widowed"|"partnership", "partnerName": string, ' +
          '"partnerDOB": string, "partnerOccupation": string, "hasWill": boolean, ' +
          '"dependents": [{"name": string, "dob": string, "relation": string}] },\n' +
          '  "incomeExpenditure": { "client": { "employmentStatus": string, "sources": [{"source": string, ' +
          '"grossAmount": string, "frequency": string}] }, "partner": { same shape } },\n' +
          '  "assets": { "nonPension": [{"reference": string, "type": string, "ownership": string, "value": ' +
          'string}], "pensions": [{"provider": string, "type": string, "value": string}] },\n' +
          '  "liabilities": { "items": [{"type": string, "provider": string, "amountOutstanding": string}] },\n' +
          '  "insurance": { "hasLifeInsurance": boolean, "policies": [{"provider": string, "policyType": ' +
          'string}] },\n' +
          '  "investmentQuestions": { "hasOtherAdvisor": boolean, "investmentObjectives": string, ' +
          '"prefersPassive": boolean, "prefersActive": boolean },\n' +
          '  "retirementQuestions": { "minMonthlyIncomeRequirement": string, "pensionIntention": string },\n' +
          '  "lifeEvents": string[] — significant life events mentioned (e.g. "Getting married next year", ' +
          '"Recently inherited a property", "Changing jobs in March"),\n' +
          '  "taxConcerns": string — any tax worries or questions the client raised (CGT, IHT, income tax) in ' +
          'their own words, or omit if none mentioned,\n' +
          '  "riskBehaviourNotes": string — how the client TALKED about risk/losses/volatility in their own ' +
          'words (e.g. "said they panicked and sold everything in 2020"), purely descriptive. This is NEVER a ' +
          'substitute for the formal Attitude-to-Risk questionnaire, which still needs the client\'s own direct ' +
          'answers — this field exists only so the adviser has the conversational context on hand,\n' +
          '  "gaps": string[] — a plain-English list of important Fact Find information the notes did NOT ' +
          'cover, that the adviser should follow up on (e.g. "Date of birth not mentioned", "No mention of ' +
          'existing pension arrangements")\n' +
          '}',
        user: notes,
        maxTokens: 1500,
      });
      return { parsed, error: null };
    } catch (err: any) {
      this.logger.warn(`Fact find note parsing failed: ${err?.message ?? err}`);
      return { parsed: null, error: err?.message ?? 'AI parsing is currently unavailable.' };
    }
  }
}
