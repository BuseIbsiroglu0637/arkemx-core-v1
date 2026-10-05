import { v3Projects } from "../data/projects-v3";
import {
  applyPublishedProjectEvidence,
  type V3PublishedProjectRecord,
} from "./project-evidence";
import { getPublishedProjectEvidence } from "./project-evidence-store";

export async function getPublicV3Projects(): Promise<readonly V3PublishedProjectRecord[]> {
  return Promise.all(v3Projects.map(async (project) =>
    applyPublishedProjectEvidence(project, await getPublishedProjectEvidence(project.slug))));
}
