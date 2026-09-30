import { redirect } from "next/navigation";
import { accountReturnPath, accountSignInPath } from "../chatgpt-auth";

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

export function GET(request: Request) {
  const url = new URL(request.url);
  const requestedReturn = url.searchParams.get("return_to") ?? returnTargetFromReferer(request);
  const returnTo = accountReturnPath(requestedReturn);
  const setupReturn = `/hesap-kurulum?return_to=${encodeURIComponent(returnTo)}`;
  redirect(accountSignInPath(setupReturn));
}
