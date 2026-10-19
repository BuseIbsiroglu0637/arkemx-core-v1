/** Reject HTML, malformed and oversized upstream data; never buffer without a limit. */
export async function readBoundedJson(response: Response, maxBytes = 2 * 1024 * 1024): Promise<unknown> {
  if (!/^application\/(?:[\w.-]+\+)?json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) { await response.body?.cancel(); throw new Error('Upstream response is not JSON'); }
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) { await response.body?.cancel(); throw new Error('Upstream response is too large'); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing upstream body');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error('Upstream response is too large');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object') throw new Error('Invalid upstream data');
    return data;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
