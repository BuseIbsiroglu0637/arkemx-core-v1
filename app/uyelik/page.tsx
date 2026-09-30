import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getArkemAccountUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Hesabım | ARKEMX",
  robots: { index: false, follow: false },
};

export default async function MembershipPage() {
  const user = await getArkemAccountUser();
  if (!user) redirect("/giris?return_to=%2Fhesabim");
  redirect("/hesabim");
}
