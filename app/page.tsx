import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getArkemAccountUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ARKEMX",
  description: "ARKEMX güvenli proje çalışma alanı.",
  robots: { index: false, follow: false },
};

export default async function Home() {
  const user = await getArkemAccountUser();

  if (!user) {
    redirect("/giris?return_to=%2Fdijital-proje-merkezi");
  }

  redirect("/hesap-kurulum?return_to=%2Fdijital-proje-merkezi");
}
