import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/en",
    languages: { "tr-TR": "/", "x-default": "/" },
  },
};

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <div lang="en" data-locale="en">{children}</div>;
}
