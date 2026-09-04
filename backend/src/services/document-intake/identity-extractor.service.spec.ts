import { IdentityExtractorService } from './identity-extractor.service';

describe('IdentityExtractorService', () => {
  it('returns the parsed identity with no error on success', async () => {
    const claude = { completeJSON: jest.fn().mockResolvedValue({ firstName: 'Jane', lastName: 'Smith' }) };
    const service = new IdentityExtractorService(claude as any);

    const result = await service.extract('some document text');

    expect(result).toEqual({ parsed: { firstName: 'Jane', lastName: 'Smith' }, error: null });
  });

  it('degrades gracefully (never throws) when Claude is unavailable or returns garbage', async () => {
    const claude = { completeJSON: jest.fn().mockRejectedValue(new Error('Claude API key not configured')) };
    const service = new IdentityExtractorService(claude as any);

    const result = await service.extract('some document text');

    expect(result).toEqual({ parsed: null, error: 'Claude API key not configured' });
  });

  it('truncates the document text to 20,000 characters before sending it to Claude', async () => {
    const claude = { completeJSON: jest.fn().mockResolvedValue({}) };
    const service = new IdentityExtractorService(claude as any);
    const longText = 'x'.repeat(30_000);

    await service.extract(longText);

    const callArgs = claude.completeJSON.mock.calls[0][0];
    expect(callArgs.user).toHaveLength(20_000);
  });
});
