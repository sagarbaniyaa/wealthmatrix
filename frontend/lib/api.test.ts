import { api } from './api';

function mockFetchOnce(response: Partial<Response> & { jsonBody?: unknown }) {
  const { jsonBody, ...rest } = response;
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => jsonBody,
    blob: async () => new Blob(),
    ...rest,
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('api.get/post/patch/delete', () => {
  it('calls the proxy path, not the backend directly (the token never reaches browser JS)', async () => {
    mockFetchOnce({ jsonBody: { ok: true } });
    await api.get('households');
    expect(global.fetch).toHaveBeenCalledWith('/api/proxy/households', expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }));
  });

  it('JSON-encodes the body on post/patch', async () => {
    mockFetchOnce({ jsonBody: { id: '1' } });
    await api.post('households', { name: 'Smith Family' });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Smith Family' }));
  });

  it('sends no body on delete', async () => {
    mockFetchOnce({ status: 204, jsonBody: undefined });
    await api.delete('households/1');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });

  it('returns undefined for a 204 No Content response rather than trying to parse an empty body as JSON', async () => {
    mockFetchOnce({ status: 204 });
    const result = await api.delete('households/1');
    expect(result).toBeUndefined();
  });

  it('throws the backend\'s error message when the response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false, status: 403, json: async () => ({ message: 'You are not assigned to this household.' }),
    });
    await expect(api.get('households/x')).rejects.toThrow('You are not assigned to this household.');
  });

  it('falls back to a generic message when the error response has no JSON body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false, status: 500, json: async () => { throw new Error('not json'); },
    });
    await expect(api.get('households/x')).rejects.toThrow('Request failed: 500');
  });
});

describe('api.postForm', () => {
  it('sends the FormData as-is, with no Content-Type header (the browser sets the multipart boundary itself)', async () => {
    mockFetchOnce({ jsonBody: { id: '1' } });
    const form = new FormData();
    form.append('file', new Blob(['hello']), 'test.pdf');
    await api.postForm('households/1/documents', form);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/proxy/households/1/documents');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(form);
    expect(init.headers).toBeUndefined();
  });
});

describe('api.getBlob / postBlob', () => {
  it('getBlob returns a Blob, not parsed JSON', async () => {
    const blob = new Blob(['%PDF-fake']);
    mockFetchOnce({ blob: async () => blob });
    const result = await api.getBlob('households/1/provider-pack.pdf');
    expect(result).toBe(blob);
  });

  it('postBlob JSON-encodes the request body but returns a Blob', async () => {
    const blob = new Blob(['PK-fake-zip']);
    mockFetchOnce({ blob: async () => blob });
    const result = await api.postBlob('households/1/provider-pack', { includeCompliance: true });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.body).toBe(JSON.stringify({ includeCompliance: true }));
    expect(result).toBe(blob);
  });
});
