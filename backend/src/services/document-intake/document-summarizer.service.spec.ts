import { DocumentSummarizerService } from './document-summarizer.service';
import { ClientDocumentType } from '../../common/enums/domain.enums';

describe('DocumentSummarizerService', () => {
  it('returns the parsed summary with no error on success', async () => {
    const claude = { completeJSON: jest.fn().mockResolvedValue({ summary: 'A balanced-risk client.', keyFacts: ['ATR: 62'] }) };
    const service = new DocumentSummarizerService(claude as any);

    const result = await service.summarize(ClientDocumentType.RISK_PROFILE, 'text');

    expect(result).toEqual({ parsed: { summary: 'A balanced-risk client.', keyFacts: ['ATR: 62'] }, error: null });
  });

  it('degrades gracefully (never throws) when Claude is unavailable', async () => {
    const claude = { completeJSON: jest.fn().mockRejectedValue(new Error('Claude unavailable')) };
    const service = new DocumentSummarizerService(claude as any);

    const result = await service.summarize(ClientDocumentType.BANK_STATEMENT, 'text');

    expect(result).toEqual({ parsed: null, error: 'Claude unavailable' });
  });

  it('tailors the system prompt focus to the document type', async () => {
    const claude = { completeJSON: jest.fn().mockResolvedValue({ summary: '', keyFacts: [] }) };
    const service = new DocumentSummarizerService(claude as any);

    await service.summarize(ClientDocumentType.PROVIDER_STATEMENT, 'text');

    const systemPrompt = claude.completeJSON.mock.calls[0][0].system;
    expect(systemPrompt).toContain('pension/investment provider statement');
  });

  it('falls back to a generic focus for a document type with no specific mapping', async () => {
    const claude = { completeJSON: jest.fn().mockResolvedValue({ summary: '', keyFacts: [] }) };
    const service = new DocumentSummarizerService(claude as any);

    await service.summarize(ClientDocumentType.CALL_TRANSCRIPT, 'text');

    const systemPrompt = claude.completeJSON.mock.calls[0][0].system;
    expect(systemPrompt).toContain('a client document uploaded by their financial adviser');
  });
});
