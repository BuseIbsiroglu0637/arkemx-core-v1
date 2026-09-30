import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { accountReturnPath } from "../chatgpt-auth";

export const metadata: Metadata = {
  title: "Hesap Kurulumu | ARKEMX",
  robots: { index: false, follow: false },
};

type RegisterPageProps = {
  searchParams?: Promise<{ return_to?: string | string[] }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const rawReturnTo = Array.isArray(params?.return_to) ? params?.return_to[0] : params?.return_to;
  const returnTo = accountReturnPath(rawReturnTo);
  redirect(`/hesap-kurulum?return_to=${encodeURIComponent(returnTo)}`);
}
