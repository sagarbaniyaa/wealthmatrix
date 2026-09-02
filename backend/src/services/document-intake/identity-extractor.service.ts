import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';

export interface ExtractedIdentity {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string; // ISO yyyy-mm-dd
  email?: string;
  phone?: string;
  niNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Pulls the client's core identity fields (name/DOB/address/contact/NI)
 * out of an uploaded fact-find document, ID, or proof-of-address —
 * these live on PersonEntity, not fact_find, so this is a separate,
 * narrower extraction from FactFindParserService (which only fills
 * fact_find's own circumstantial/financial sections). Same discipline:
 * omit a field entirely rather than guess it.
 */
@Injectable()
export class IdentityExtractorService {
  private readonly logger = new Logger(IdentityExtractorService.name);

  constructor(private readonly claude: ClaudeClientService) {}

  async extract(text: string): Promise<{ parsed: ExtractedIdentity | null; error: string | null }> {
    try {
      const parsed = await this.claude.completeJSON<ExtractedIdentity>({
        system:
          'You extract a UK financial advice client\'s core identity details from a document (a fact find, ' +
          'ID document, or proof of address). Only include a field if the document actually states it — never ' +
          'invent or guess a name, date, number, or address. Respond with ONLY a JSON object (no prose, no ' +
          'markdown fences) matching this shape, omitting any key the document doesn\'t state:\n' +
          '{ "firstName": string, "lastName": string, "dateOfBirth": "YYYY-MM-DD", "email": string, ' +
          '"phone": string, "niNumber": string (UK National Insurance number, e.g. "QQ123456C"), ' +
          '"addressLine1": string, "addressLine2": string, "city": string, "postalCode": string, ' +
          '"country": string }',
        user: text.slice(0, 20_000),
      });
      return { parsed, error: null };
    } catch (err) {
      this.logger.warn(`Identity extraction failed: ${(err as Error).message}`);
      return { parsed: null, error: (err as Error).message };
    }
  }
}
