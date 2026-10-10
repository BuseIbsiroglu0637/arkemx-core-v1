import { SHELL_UNITS, validateShellSource, type ShellSource } from "./shell-source.ts";

export function createShellExamples(preset: "SS-H" | "CL" = "SS-H", density: "coarse" | "medium" | "fine" | "refined" = "medium"): ShellSource[] {
  if (!["coarse","medium","fine","refined"].includes(density)) throw Error("Ağ yoğunluğu coarse / medium / fine / refined olmalı.");
  const n = density === "coarse" ? 4 : density === "medium" ? 8 : density === "fine" ? 16 : 32;
  return [1,2].map(level=>{
    const source: ShellSource = {
      schema:density==="refined"?"ARKEM-SHELL-SOURCE/1.1":"ARKEM-SHELL-SOURCE/1.0",projectId:"ARKEMX-ORNEK-SHELL-B06",revision:density==="refined"?"ORNEK-SHELL-01-R1":"ORNEK-SHELL-01",fixture:"synthetic",
      units:{...SHELL_UNITS},
      plate:{id:"P"+level,sourceLevel:level,origin:[0,0,level===1?0:3.4],width:level===1?10:20,depth:10,thickness:.16},
      material:{id:"M-PLATE",name:"Örnek izotrop elastik malzeme",E:30e6,nu:.2,unitWeight:25},
      mesh:{nx:level===1?n:2*n,ny:n},supports:{preset},
      loads:{slabSelfWeight:true,superDeadLoad:2.2,liveLoad:3.5,benchmarkLoad:1},
      fullBuildingAnalysis:false,technicalApproval:false,
    };
    validateShellSource(source);
    return source;
  });
}
