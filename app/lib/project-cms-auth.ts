import { getArkemAccountUser, type ArkemAccountUser } from "../chatgpt-auth";
import { isCmsEditorEmail, resolveCmsEditorAccess } from "./project-cms-policy";

export { isCmsEditorEmail, parseProjectCmsEditors, resolveCmsEditorAccess } from "./project-cms-policy";

export const PROJECT_CMS_EDITOR_ENV = "ARKEM_CMS_EDITOR_EMAILS";

export type ProjectCmsAuthorization =
  | { status: "authorized"; user: ArkemAccountUser }
  | { status: "unauthenticated"; user: null }
  | { status: "forbidden"; user: ArkemAccountUser };

async function configuredEditorEmails(): Promise<unknown> {
  try {
    const { env } = await import("cloudflare:workers");
    return (env as unknown as Record<string, unknown>)[PROJECT_CMS_EDITOR_ENV];
  } catch {
    return undefined;
  }
}

export async function isProjectCmsEditor(user: ArkemAccountUser): Promise<boolean> {
  return isCmsEditorEmail(user.email, await configuredEditorEmails());
}

export async function getProjectCmsAuthorization(): Promise<ProjectCmsAuthorization> {
  const user = await getArkemAccountUser();
  const configuredEditors = await configuredEditorEmails();
  const status = resolveCmsEditorAccess(user?.email ?? null, configuredEditors);
  if (!user || status === "unauthenticated") return { status: "unauthenticated", user: null };
  if (status === "forbidden") return { status: "forbidden", user };
  return { status: "authorized", user };
}
