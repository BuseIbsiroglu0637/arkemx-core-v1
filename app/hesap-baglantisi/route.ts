import { redirect } from "next/navigation";
import { accountSignInPath } from "../chatgpt-auth";

export function GET(request: Request) {
  const url = new URL(request.url);
  redirect(accountSignInPath(url.searchParams.get("return_to") || "/uyelik"));
}
