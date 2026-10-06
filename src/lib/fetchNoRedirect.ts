/** Server-only transport: one request, never follows credential-bearing redirects. */
export async function fetchNoRedirect(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { ...init, redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('Upstream redirect refused.');
  }
  return response;
}
