import { BadRequestException, Injectable } from '@nestjs/common';
import { ClientDocumentType } from '../../common/enums/domain.enums';
import { ClientDocumentEntity } from '../../database/entities';
import { ClientDocumentService } from '../../modules/client-document/client-document.service';
import { DocumentIntakeService } from '../document-intake/document-intake.service';
import { CALL_SUGGESTION_TRIGGERS } from './call-suggestion.constants';

export interface CallSuggestion {
  key: string;
  label: string;
  description: string;
  linkPath: string;
}

/**
 * Backs "Start Client Call" (spec §1-3): live keyword-based suggestions
 * during the call (see call-suggestion.constants.ts), and — on
 * "End Call" — routes the full transcript through the EXACT SAME
 * Document Intake pipeline a manually uploaded Fact Find document uses
 * (just tagged CALL_TRANSCRIPT instead of FACT_FIND_SOURCE). No second
 * extraction engine to maintain.
 *
 * Deliberately transcript-only, not an audio recording: the browser's
 * built-in speech recognition (see the frontend call screen) produces
 * live text with no API cost and no audio file to store, which sidesteps
 * both the cost of a paid transcription API and the extra data-
 * protection burden of retaining a client's actual voice recording.
 * The compliance value — a searchable, timestamped record of what was
 * discussed — is the same either way.
 */
@Injectable()
export class CallSessionService {
  constructor(
    private readonly clientDocuments: ClientDocumentService,
    private readonly documentIntake: DocumentIntakeService,
  ) {}

  getSuggestions(householdId: string, transcript: string, alreadyShown: string[]): CallSuggestion[] {
    return CALL_SUGGESTION_TRIGGERS
      .filter((t) => !alreadyShown.includes(t.key))
      .filter((t) => t.keywords.test(transcript))
      .map((t) => ({ key: t.key, label: t.label, description: t.description, linkPath: t.linkPath(householdId) }));
  }

  async finishCall(householdId: string, transcript: string, uploadedBy: string): Promise<ClientDocumentEntity> {
    const trimmed = transcript.trim();
    if (trimmed.length < 20) {
      throw new BadRequestException('This transcript looks too short to process — check the microphone captured the call.');
    }

    const saved = await this.clientDocuments.saveUploaded({
      householdId,
      documentType: ClientDocumentType.CALL_TRANSCRIPT,
      fileName: `call-transcript-${new Date().toISOString().slice(0, 10)}.txt`,
      mimeType: 'text/plain',
      fileData: Buffer.from(trimmed, 'utf8'),
      uploadedBy,
    });

    return this.documentIntake.ingest(saved.id, uploadedBy);
  }
}
