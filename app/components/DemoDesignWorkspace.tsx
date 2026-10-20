"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { AdvancedPlanEditor } from "./AdvancedPlanEditor";
import { StructuralDesigner } from "./StructuralDesigner";
const subscribe = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};
export function DemoDesignWorkspace() {
  const structural = useSyncExternalStore(subscribe, () => window.location.hash === "#tasiyici-on-tasarim", () => false);
  return <main className="bim-demo-page shell">
    {structural ? <><Link href="#plan-editor">← Plan ve aks modeline dön</Link><section id="tasiyici-on-tasarim"><StructuralDesigner/></section></>
      : <section id="plan-editor"><AdvancedPlanEditor/></section>}
  </main>;
}
