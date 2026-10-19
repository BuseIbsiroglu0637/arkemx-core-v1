/** Bound actual incoming bytes before multipart/JSON parsing, not just declared length. */
export class RequestInputError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RequestInputError";
    this.status = status;
  }
}

function limitedBody(request: Request, limit: number) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new RequestInputError(413, "İstek boyutu izin verilen sınırı aşıyor.");
  if (!request.body) throw new RequestInputError(400, "İstek gövdesi boş.");
  const reader = request.body.getReader();
  let received = 0;
  let terminated = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (terminated) return;
        if (done) { terminated = true; controller.close(); return; }
        received += value.byteLength;
        if (received > limit) {
          terminated = true;
          controller.error(new RequestInputError(413, "İstek boyutu izin verilen sınırı aşıyor."));
          await reader.cancel();
          return;
        }
        controller.enqueue(value);
      } catch (error) { if (!terminated) { terminated = true; controller.error(error); } }
    },
    cancel(reason) { terminated = true; return reader.cancel(reason); },
  });
}

export async function readBoundedFormData(request: Request, limit: number) {
  const bytes = await new Response(limitedBody(request, limit)).arrayBuffer();
  return new Response(bytes, { headers: request.headers }).formData();
}

export async function readBoundedJsonObject(request: Request, limit = 400_000): Promise<Record<string, unknown>> {
  const text = await new Response(limitedBody(request, limit)).text();
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestInputError(400, "İstek bir JSON nesnesi olmalı.");
  return value as Record<string, unknown>;
}

export function requestInputFailure(error: unknown, fallback: string) {
  return Response.json({ error: error instanceof RequestInputError ? error.message : fallback }, { status: error instanceof RequestInputError ? error.status : 400 });
}
