import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';
import { ClientDocumentType } from '../../common/enums/domain.enums';

export interface DocumentSummary {
  summary: string; // 2-4 plain-English sentences an adviser can read at a glance
  keyFacts: string[]; // short bullet facts worth flagging (a stated policy number, a stated risk category, an unusual transaction, etc.)
}

const TYPE_FOCUS: Partial<Record<ClientDocumentType, string>> = {
  [ClientDocumentType.RISK_PROFILE]: 'a client risk-profiling questionnaire or report. Note any stated risk category/tolerance and the reasoning given for it.',
  [ClientDocumentType.BANK_STATEMENT]: 'a bank statement. Note the account holder, statement period, and any pattern relevant to affordability or income (do not list every transaction).',
  [ClientDocumentType.PROVIDER_STATEMENT]: 'a pension/investment provider statement. Note the provider name, policy/plan number, current value, and any charges stated.',
  [ClientDocumentType.FILE_NOTE]: 'an adviser file note. Note the date, topic discussed, and any action agreed.',
};

/**
 * For document types where auto-writing structured fields would be too
 * risky to do unattended (a bank statement's transactions, a risk
 * questionnaire's own wording, an adviser's free-text file note) —
 * this produces a short human-readable summary + key facts instead of
 * silently overwriting platform data. The summary is stored on the
 * document itself and posted as a client note so it surfaces where an
 * adviser will actually see it, without guessing at fields there's no
 * safe place to put automatically.
 */
@Injectable()
export class DocumentSummarizerService {
  private readonly logger = new Logger(DocumentSummarizerService.name);

  constructor(private readonly claude: ClaudeClientService) {}

  async summarize(documentType: ClientDocumentType, text: string): Promise<{ parsed: DocumentSummary | null; error: string | null }> {
    const focus = TYPE_FOCUS[documentType] ?? 'a client document uploaded by their financial adviser.';
    try {
      const parsed = await this.claude.completeJSON<DocumentSummary>({
        system:
          `The following text was OCR/text-extracted from ${focus} Summarise it for a UK financial adviser ` +
          'reviewing their client file. Only state what the document actually says — never invent figures or ' +
          'facts. Respond with ONLY a JSON object (no prose, no markdown fences): ' +
          '{ "summary": string, "keyFacts": string[] }',
        user: text.slice(0, 20_000),
      });
      return { parsed, error: null };
    } catch (err) {
      this.logger.warn(`Document summarisation failed: ${(err as Error).message}`);
      return { parsed: null, error: (err as Error).message };
    }
  }
}
