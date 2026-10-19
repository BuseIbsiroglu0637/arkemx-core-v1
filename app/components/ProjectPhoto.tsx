import Image from "next/image";
import type { CSSProperties } from "react";
import { projectPhotoWindows } from "../lib/project-photo";

export function ProjectPhoto({ src, alt, sizes = "100vw", priority = false, natural = false }: {
  src: string; alt: string; sizes?: string; priority?: boolean; natural?: boolean;
}) {
  const crop = projectPhotoWindows[src];
  return <div className={`project-photo${natural ? " is-natural" : ""}`} data-photo-window={crop ? "archive-photograph" : "original"}>
    {crop ? <div className="project-photo-plane">
      <Image src={src} alt={alt} width={1600} height={1000} priority={priority} sizes={sizes} unoptimized
        style={{ "--photo-width": `${1600 / crop.size * 100}%`, "--photo-height": `${1000 / crop.size * 100}%`, "--photo-left": `${-crop.x / crop.size * 100}%`, "--photo-top": `${-crop.y / crop.size * 100}%` } as CSSProperties} />
    </div> : <Image src={src} alt={alt} fill priority={priority} sizes={sizes} unoptimized />}
  </div>;
}
