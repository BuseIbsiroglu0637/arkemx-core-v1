import type { CorridorGeometry, RoomGeometry } from "../lib/measured-plan";
export function MeasuredCorridor({value,originX,originY,scale}:{value:CorridorGeometry;originX:number;originY:number;scale:number}) {
  return <g className="measured-corridor" aria-label="Koridor"><rect x={originX+value.x*scale} y={originY+value.y*scale} width={value.width*scale} height={value.depth*scale}/><text x={originX+8} y={originY+(value.y+value.depth/2)*scale+3}>Koridor {value.depth.toFixed(2)} m</text></g>;
}
export function MeasuredRoom({value,label,selected,originX,originY,scale,onSelect}:{value:RoomGeometry;label:string;selected:boolean;originX:number;originY:number;scale:number;onSelect:(event:React.MouseEvent)=>void}) {
  const x=originX+value.x*scale,y=originY+value.y*scale,w=value.width*scale,h=value.depth*scale;
  const doorX=x+w/2,doorY=value.side==="bottom"?y+h:y,half=value.doorWidth*scale/2,leaf=value.doorWidth*scale;
  const sign=value.side==="bottom"?-1:1;
  return <g className={"measured-room"+(selected?" selected":"")} onClick={onSelect} aria-label={label}>
    <title>{label} · {value.width.toFixed(2)} × {value.depth.toFixed(2)} m · {value.area.toFixed(1)} m² · Kapı {value.doorWidth.toFixed(2)} m</title>
    {selected&&<polyline className="measured-route" points={value.route.map(p=>(originX+p.x*scale)+","+(originY+p.y*scale)).join(" ")}/>}
    <rect x={x} y={y} width={w} height={h}/>
    <text x={x+w/2} y={y+h/2-10} textAnchor="middle">{label.length>16?label.slice(0,15)+"…":label}</text>
    <text className="measured-dim" x={x+w/2} y={y+h/2+3} textAnchor="middle">{value.width.toFixed(2)} × {value.depth.toFixed(2)} m</text>
    <text className="measured-dim" x={x+w/2} y={y+h/2+16} textAnchor="middle">{value.area.toFixed(1)} m²</text>
    <line className="measured-door-gap" x1={doorX-half} y1={doorY} x2={doorX+half} y2={doorY}/>
    <path className="measured-door" d={"M "+(doorX-half)+" "+doorY+" l 0 "+sign*leaf+" A "+leaf+" "+leaf+" 0 0 "+(sign===1?0:1)+" "+(doorX+half)+" "+doorY}/>
  </g>;
}
