"use client";

import { useEffect, useMemo, useState } from "react";
import { useProjectKernel } from "./ProjectKernel";
import { decodeProjectEnvelope, PROJECT_BACKUP_KEY, PROJECT_STORAGE_KEY } from "../lib/project-storage";

type DebugGeo = {
  province?: string;
  district?: string;
  neighborhood?: string;
  block?: string;
  parcelNo?: string;
  buildingWidth?: number;
  buildingDepth?: number;
  floors?: number;
  floorHeight?: number;
  parcel?: unknown[];
  previewParcel?: unknown[];
};

type DebugProject = {
  id?: string;
  name?: string;
  revision?: string;
  updatedAt?: string;
  modules?: Record<string, unknown>;
};

type DebugEvent = {
  at?: string;
  event?: string;
  projectId?: string;
  moduleCount?: number;
  geo?: Record<string, unknown>;
  detail?: string;
};

const DEBUG_KEY = "arkemx-project-debug-v1";

function projectSummary(value: DebugProject | null | undefined) {
  const modules = value?.modules && typeof value.modules === "object" ? value.modules : {};
  const geo = (modules["geo-parcel"] ?? {}) as DebugGeo;
  const parcelVertices = Array.isArray(geo.parcel) && geo.parcel.length
    ? geo.parcel.length
    : Array.isArray(geo.previewParcel)
      ? geo.previewParcel.length
      : 0;
  return {
    id: value?.id ?? "—",
    revision: value?.revision ?? "—",
    moduleCount: Object.keys(modules).length,
    geo: {
      province: geo.province ?? "",
      district: geo.district ?? "",
      neighborhood: geo.neighborhood ?? "",
      block: geo.block ?? "",
      parcelNo: geo.parcelNo ?? "",
      parcelVertices,
      buildingWidth: geo.buildingWidth ?? null,
      buildingDepth: geo.buildingDepth ?? null,
      floors: geo.floors ?? null,
      floorHeight: geo.floorHeight ?? null,
    },
    updatedAt: value?.updatedAt ?? "",
  };
}

export function ProjectStateDebug() {
  const { project, hydrated, persistence } = useProjectKernel();
  const [snapshot, setSnapshot] = useState<{
    primary: ReturnType<typeof projectSummary>;
    backup: ReturnType<typeof projectSummary>;
    draft: unknown;
    events: DebugEvent[];
  } | null>(null);
  const runtime = useMemo(() => projectSummary(project), [project]);

  const refresh = () => {
    try {
      const primary = decodeProjectEnvelope<DebugProject>(window.localStorage.getItem(PROJECT_STORAGE_KEY));
      const backup = decodeProjectEnvelope<DebugProject>(window.localStorage.getItem(PROJECT_BACKUP_KEY));
      const draftRaw = window.localStorage.getItem(`arkemx-geo-draft:${project.id}`);
      const draftParsed = draftRaw ? JSON.parse(draftRaw) as { payload?: DebugGeo } : null;
      const events = JSON.parse(window.sessionStorage.getItem(DEBUG_KEY) || "[]") as DebugEvent[];
      setSnapshot({
        primary: projectSummary(primary.value),
        backup: projectSummary(backup.value),
        draft: draftParsed?.payload ? {
          neighborhood: draftParsed.payload.neighborhood ?? "",
          block: draftParsed.payload.block ?? "",
          parcelNo: draftParsed.payload.parcelNo ?? "",
          parcelVertices: Array.isArray(draftParsed.payload.parcel) && draftParsed.payload.parcel.length
            ? draftParsed.payload.parcel.length
            : Array.isArray(draftParsed.payload.previewParcel)
              ? draftParsed.payload.previewParcel.length
              : 0,
          buildingWidth: draftParsed.payload.buildingWidth ?? null,
          buildingDepth: draftParsed.payload.buildingDepth ?? null,
          floors: draftParsed.payload.floors ?? null,
          floorHeight: draftParsed.payload.floorHeight ?? null,
        } : null,
        events: events.slice(-12),
      });
    } catch {
      setSnapshot(null);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, [project.id, project.updatedAt]);

  const report = {
    hydrated,
    persistence,
    runtime,
    storagePrimary: snapshot?.primary ?? null,
    storageBackup: snapshot?.backup ?? null,
    geoDraft: snapshot?.draft ?? null,
    recentEvents: snapshot?.events ?? [],
  };

  return <details className="arx-project-debug">
    <summary>Teknik debug · proje durumu</summary>
    <div className="arx-project-debug-actions">
      <button type="button" onClick={refresh}>Yenile</button>
      <button type="button" onClick={() => { void navigator.clipboard?.writeText(JSON.stringify(report, null, 2)); }}>
        Debug çıktısını kopyala
      </button>
    </div>
    <pre>{JSON.stringify(report, null, 2)}</pre>
  </details>;
}
