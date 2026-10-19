import { NextResponse } from "next/server";
import {
  arkemXDevelopmentJournal,
  arkemXRoadmap,
} from "../../data/arkemx-module-registry";
import {
  publicArkemXModuleGroups,
  publicArkemXModules,
  publicArkemXRegistryMeta,
} from "../../data/arkemx-public-projection";

export async function GET() {
  return NextResponse.json(
    {
      meta: publicArkemXRegistryMeta,
      groups: publicArkemXModuleGroups,
      modules: publicArkemXModules,
      developmentJournal: arkemXDevelopmentJournal,
      roadmap: arkemXRoadmap,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
