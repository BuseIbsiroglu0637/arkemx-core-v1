"use client";
import { useRef, useState } from "react";

export function useExportFeedback() {
  const busy = useRef(false);
  const [exportState, setExportState] = useState<"idle" | "busy" | "ready" | "error">("idle");
  async function runExport(task: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setExportState("busy");
    try { await task(); setExportState("ready"); }
    catch { setExportState("error"); }
    finally { busy.current = false; }
  }
  const exportMessage = exportState === "busy" ? "PDF hazırlanıyor…" : exportState === "ready" ? "PDF hazır; indirme başlatıldı." : exportState === "error" ? "PDF hazırlanamadı. Bağlantınızı kontrol edip yeniden deneyin; proje bilgileriniz korunuyor." : "";
  return { runExport, exportState, exportMessage };
}
