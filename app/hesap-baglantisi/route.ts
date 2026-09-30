import { redirect } from "next/navigation";
import { accountReturnPath, accountSignInPath, getArkemAccountUser, isPrototypeDemoAuthEnabled } from "../chatgpt-auth";

function returnTargetFromReferer(request: Request) {
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.pathname === "/giris" ? url.searchParams.get("return_to") : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedReturn = url.searchParams.get("return_to") ?? returnTargetFromReferer(request);
  const returnTo = accountReturnPath(requestedReturn);
  const setupReturn = `/hesap-kurulum?return_to=${encodeURIComponent(returnTo)}`;

  if (isPrototypeDemoAuthEnabled()) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: setupReturn,
        "Set-Cookie": "arkemx_prototype_session=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  const user = await getArkemAccountUser();
  if (user) redirect(setupReturn);
  redirect(accountSignInPath(setupReturn));
}
