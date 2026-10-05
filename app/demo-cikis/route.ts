import { accountReturnPath, isPrototypeDemoAuthEnabled } from "../chatgpt-auth";

export function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = accountReturnPath(url.searchParams.get("return_to"), "/giris");

  if (!isPrototypeDemoAuthEnabled()) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: returnTo,
      "Set-Cookie": "arkemx_prototype_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
