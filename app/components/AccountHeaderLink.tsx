import Link from "next/link";
import { getArkemAccountUser } from "../chatgpt-auth";

export async function AccountHeaderLink({ label = "Hesabım" }: { label?: string }) {
  const user = await getArkemAccountUser();
  const href = user ? "/hesabim" : "/giris?return_to=%2Fhesabim";
  return <Link href={href}>{label}</Link>;
}
