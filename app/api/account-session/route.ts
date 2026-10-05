import { getArkemAccountSession } from "../../chatgpt-auth";

export async function GET() {
  const session = await getArkemAccountSession();
  return Response.json(
    session.user
      ? {
          authenticated: true,
          user: { displayName: session.user.displayName, email: session.user.email },
          identitySource: session.identitySource,
        }
      : {
          authenticated: false,
          user: null,
          identitySource: session.identitySource,
        },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
