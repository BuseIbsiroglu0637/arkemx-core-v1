/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { isDemoRequestBlocked } from "../app/lib/demo";
import { withResponseSecurity } from "../app/lib/response-security";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (isDemoRequestBlocked(url.pathname, request.method)) {
      return withResponseSecurity(request, Response.json({ error: "Demo sürümünde gerçek başvuru, hesap ve belge işlemleri kapalıdır. Çalışmanızı JSON olarak indirebilirsiniz.", demo: true }, { status: 403 }));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = withResponseSecurity(request, await handler.fetch(request, env, ctx));
    const isDevelopmentPreview = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "terminal.local";
    if (!isDevelopmentPreview || !response.headers.get("content-type")?.includes("text/html")) return response;

    const html = await response.text();
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(html.replace("<head>", '<head><meta name="codex-preview" content="development"/>'), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

export default worker;
