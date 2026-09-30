import { getArkemAccountUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getArkemAccountUser();
  return Response.json(
    user
      ? {
          authenticated: true,
          user: { displayName: user.displayName, email: user.email },
          identitySource: "hosting-header",
        }
      : {
          authenticated: false,
          user: null,
          identitySource: "hosting-header",
        },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
