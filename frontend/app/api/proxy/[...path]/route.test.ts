/**
 * @jest-environment node
 *
 * Route Handlers need real Request/Response/Headers globals (Node 18+
 * has these natively) — jsdom's fetch polyfill is incomplete for this,
 * hence the node environment override for this one file.
 */
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { GET, POST, DELETE } from './route';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));

const mockCookies = cookies as jest.Mock;

function withToken(token: string | undefined) {
  mockCookies.mockReturnValue({ get: (name: string) => (name === 'wm_token' && token ? { value: token } : undefined) });
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  };
}

beforeEach(() => {
  process.env.BACKEND_API_URL = 'http://backend.internal';
  global.fetch = jest.fn();
});

describe('proxy — authentication', () => {
  it('returns 401 with no backend call at all when there is no token cookie', async () => {
    withToken(undefined);
    const req = new NextRequest('http://localhost/api/proxy/households');
    const res = await GET(req, { params: { path: ['households'] } });

    expect(res.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('proxy — request forwarding', () => {
  it('attaches the httpOnly token as a Bearer header and preserves the query string', async () => {
    withToken('real-jwt-token');
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ id: '1' }));

    const req = new NextRequest('http://localhost/api/proxy/households/1/holdings?asOfDate=2024-01-01');
    await GET(req, { params: { path: ['households', '1', 'holdings'] } });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://backend.internal/households/1/holdings?asOfDate=2024-01-01');
    expect(init.headers.Authorization).toBe('Bearer real-jwt-token');
  });

  it('forwards a JSON POST body as text with an explicit application/json Content-Type', async () => {
    withToken('t');
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ id: '2' }, 201));

    const req = new NextRequest('http://localhost/api/proxy/households', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Smith Family' }),
    });
    const res = await POST(req, { params: { path: ['households'] } });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ name: 'Smith Family' }));
    expect(res.status).toBe(201);
  });

  it('forwards a multipart/form-data body verbatim, boundary included, as raw bytes not JSON', async () => {
    withToken('t');
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ id: 'doc-1' }));

    const boundaryContentType = 'multipart/form-data; boundary=----WebKitFormBoundaryXYZ';
    const bodyBytes = new TextEncoder().encode('fake multipart body');
    const req = new NextRequest('http://localhost/api/proxy/households/1/documents', {
      method: 'POST',
      headers: { 'content-type': boundaryContentType },
      body: bodyBytes,
    });
    await POST(req, { params: { path: ['households', '1', 'documents'] } });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers['Content-Type']).toBe(boundaryContentType);
    expect(Buffer.from(init.body)).toEqual(Buffer.from(bodyBytes));
  });

  it('attaches no body at all on DELETE, regardless of what the backend returns', async () => {
    withToken('t');
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({}, 200));

    const req = new NextRequest('http://localhost/api/proxy/households/1', { method: 'DELETE' });
    await DELETE(req, { params: { path: ['households', '1'] } });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.body).toBeUndefined();
  });
});

describe('proxy — response passthrough', () => {
  it('passes a JSON backend response straight through with its original status', async () => {
    withToken('t');
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ message: 'Forbidden' }, 403));

    const req = new NextRequest('http://localhost/api/proxy/households/1');
    const res = await GET(req, { params: { path: ['households', '1'] } });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: 'Forbidden' });
  });

  it('treats an empty/no-content-type response as text, not binary (a 200 DELETE with no JSON payload would otherwise break res.json() client-side)', async () => {
    withToken('t');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, status: 200, headers: new Headers(), text: async () => '',
    });

    const req = new NextRequest('http://localhost/api/proxy/households/1', { method: 'DELETE' });
    const res = await DELETE(req, { params: { path: ['households', '1'] } });
    expect(res.status).toBe(200);
  });

  it('passes a 204 through with no body, never attempting to JSON/text-wrap it (the Fetch spec forbids a body on 204/205/304)', async () => {
    withToken('t');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, status: 204, headers: new Headers(),
    });

    const req = new NextRequest('http://localhost/api/proxy/households/1', { method: 'DELETE' });
    const res = await DELETE(req, { params: { path: ['households', '1'] } });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('passes a binary response (e.g. the provider pack zip) through as raw bytes with its real Content-Type/Content-Disposition', async () => {
    withToken('t');
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK.. zip magic bytes
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="provider_pack.zip"' }),
      arrayBuffer: async () => zipBytes.buffer,
    });

    const req = new NextRequest('http://localhost/api/proxy/households/1/provider-pack');
    const res = await GET(req, { params: { path: ['households', '1', 'provider-pack'] } });

    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="provider_pack.zip"');
    const returnedBytes = new Uint8Array(await res.arrayBuffer());
    expect(returnedBytes).toEqual(zipBytes);
  });
});
