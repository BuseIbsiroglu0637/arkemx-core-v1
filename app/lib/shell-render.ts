import type { ShellCalculationRecord } from "./shell-solver.ts";
import type { RectangularShellPhysical } from "./shell-source.ts";
import type { ShellView } from "./shell-view.ts";
/** Rendering consumes numerical fields only; it never converts project provenance into a synthetic source. */
export type ShellRenderSource = RectangularShellPhysical & { schema:string; projectId:string; revision:string };
export type ShellRenderRecord = {
  id:string;
  content:Pick<ShellCalculationRecord["content"],"cases"|"engine"|"formulation"> & {
    prepared:{source:ShellRenderSource;model:ShellCalculationRecord["content"]["prepared"]["model"]};
  };
};
export type ShellRenderManifest = {source:ShellRenderSource; sourceSha256:string; view:ShellView};
