import type { CorridorGeometry } from "../lib/measured-plan";
export function MeasuredCoreDoor({value,originX,originY,scale}:{value:CorridorGeometry;originX:number;originY:number;scale:number}) {
  const x=originX+(value.doorX-value.doorWidth/2)*scale,y=originY+value.y*scale,w=value.doorWidth*scale;
  return <g className="measured-core-door" aria-label="Çekirdek kapısı"><line className="measured-door-gap" x1={x} y1={y} x2={x+w} y2={y}/><path className="measured-door" d={"M "+x+" "+y+" l 0 "+(-w)+" A "+w+" "+w+" 0 0 1 "+(x+w)+" "+y}/></g>;
}
