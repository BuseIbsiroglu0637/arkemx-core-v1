import { redirect } from "next/navigation";
import { accountReturnPath, accountSignInPath } from "../chatgpt-auth";

export function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = accountReturnPath(url.searchParams.get("return_to"));
  redirect(accountSignInPath(returnTo));
}
