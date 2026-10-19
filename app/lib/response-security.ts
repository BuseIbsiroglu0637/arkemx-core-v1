export function withResponseSecurity(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  const path = new URL(request.url).pathname;
  if (path.startsWith("/api/customer-workspace") || path.startsWith("/api/project-evidence") || request.headers.has("oai-authenticated-user-email")) {
    headers.set("Cache-Control", "private, no-store");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
