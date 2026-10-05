import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

export type ArkemAccountUser = ChatGPTUser;

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";
const PROTOTYPE_SIGN_OUT_PATH = "/demo-cikis";
const PROTOTYPE_SESSION_COOKIE = "arkemx_prototype_session";
const PROTOTYPE_DISPLAY_NAME = process.env.ARKEMX_PROTOTYPE_DEMO_NAME?.trim() || "Buse İbşiroğlu";
const PROTOTYPE_EMAIL = process.env.ARKEMX_PROTOTYPE_DEMO_EMAIL?.trim().toLowerCase() || "demo@arkemx.local";
const PROTOTYPE_COMPANY = process.env.ARKEMX_PROTOTYPE_DEMO_COMPANY?.trim() || "ARKEMX";

const PROTOTYPE_USER: ChatGPTUser = {
  displayName: PROTOTYPE_DISPLAY_NAME,
  email: PROTOTYPE_EMAIL,
  fullName: PROTOTYPE_DISPLAY_NAME,
};

export function prototypeDemoProfileDefaults() {
  return {
    displayName: PROTOTYPE_DISPLAY_NAME,
    company: PROTOTYPE_COMPANY,
    phone: process.env.ARKEMX_PROTOTYPE_DEMO_PHONE?.trim() || "",
    preferredLanguage: "tr",
  };
}

export type ArkemAccountSession = {
  user: ChatGPTUser | null;
  identitySource: "hosting-header" | "prototype-demo" | null;
};

export function isPrototypeDemoAuthEnabled(): boolean {
  return process.env.ARKEMX_PROTOTYPE_DEMO_AUTH === "1";
}

export async function getArkemAccountSession(): Promise<ArkemAccountSession> {
  const requestHeaders = await headers();
  const emailHeader = requestHeaders.get(USER_EMAIL_HEADER);
  const email = emailHeader?.trim().toLowerCase();

  if (email) {
    const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
    const fullName =
      encodedFullName &&
      requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
        ? safeDecodeURIComponent(encodedFullName)
        : null;

    return {
      user: {
        displayName: fullName ?? email,
        email,
        fullName,
      },
      identitySource: "hosting-header",
    };
  }

  if (
    isPrototypeDemoAuthEnabled() &&
    hasCookie(requestHeaders.get("cookie"), PROTOTYPE_SESSION_COOKIE, "1")
  ) {
    return { user: PROTOTYPE_USER, identitySource: "prototype-demo" };
  }

  return { user: null, identitySource: null };
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  return (await getArkemAccountSession()).user;
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (isPrototypeDemoAuthEnabled()) {
    return `/hesap-baglantisi?return_to=${encodeURIComponent(safeReturnTo)}`;
  }
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (isPrototypeDemoAuthEnabled()) {
    return `${PROTOTYPE_SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
  }
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export const getArkemAccountUser = getChatGPTUser;
export const requireArkemAccountUser = requireChatGPTUser;
export const accountSignInPath = chatGPTSignInPath;
export const accountSignOutPath = chatGPTSignOutPath;

export function accountReturnPath(
  value: string | null | undefined,
  fallback = "/dijital-proje-merkezi",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://app.local") return fallback;
  if (
    url.pathname === "/giris" ||
    url.pathname === "/hesap-baglantisi" ||
    url.pathname === "/hesap-kurulum" ||
    url.pathname === "/kayit" ||
    url.pathname === "/uyelik" ||
    url.pathname === "/uyelik/ayarlar" ||
    isReservedAuthPath(url.pathname)
  ) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH ||
    pathname === PROTOTYPE_SIGN_OUT_PATH
  );
}

function hasCookie(cookieHeader: string | null, name: string, value: string): boolean {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === `${name}=${value}`);
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
