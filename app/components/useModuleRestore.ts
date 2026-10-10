"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectKernel } from "./ProjectKernel";

import { moduleRecord } from "../lib/module-draft";
export { moduleRecord, restoreModuleValue } from "../lib/module-draft";

export function useModuleRestore(key: string, restore: (saved: Record<string, unknown>) => void) {
  const { project, hydrated } = useProjectKernel();
  const [restoredProject, setRestoredProject] = useState("");
  const restoreInitial = useRef(restore);
  useEffect(() => {
    if (!hydrated || restoredProject === project.id) return;
    const timer = window.setTimeout(() => {
      restoreInitial.current(moduleRecord(project.modules[key]));
      setRestoredProject(project.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, key, project.id, project.modules, restoredProject]);
  return hydrated && restoredProject === project.id;
}

