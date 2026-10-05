"use client";
import Link from "next/link";
import { assessLandCandidate, object, readLandResearch } from "../lib/land-research";
import { useProjectKernel } from "./ProjectKernel";
export function LandCandidateContext() {
  const { project, hydrated } = useProjectKernel();
  const research = readLandResearch(object(project.modules["decision-assistant"]).landResearch);
  const candidate = research?.shortlist.find(c => c.id === research.selectedId);
  if (!hydrated || !research || !candidate || assessLandCandidate(candidate, research.criteria).mismatch.length) return null;
  return <aside className="arx-candidate-context" aria-label="İncelemeye alınan arsa adayı"><b>İncelemeye alınan aday: {candidate.title}</b><p>Bu kayıt bir ilan araştırmasıdır. Ada/parsel, resmî sınır ve imar bilgileri doğrulanmış değildir; ilan alanı hesaplara aktarılmadı.</p><a href={candidate.url} target="_blank" rel="noopener noreferrer">Kaynak ilanı aç ↗</a><Link href="/arsa-arastirma">Aday karşılaştırmasına dön →</Link></aside>;
}
