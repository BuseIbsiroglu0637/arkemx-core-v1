import Image, { type ImageProps } from "next/image";
import sizes from "../lib/content-image-sizes.json";

type Props = Omit<ImageProps, "width" | "height"> & { width?: number; height?: number };
/** Preserve source URLs in the standalone preview; reserve local images' real
 * dimensions and defer offscreen images through Next Image's lazy loading. */
export function ContentImage({ width, height, alt, ...props }: Props) {
  const local = typeof props.src === "string"
    ? (sizes as Record<string, { width: number; height: number }>)[props.src]
    : undefined;
  return <Image {...props} alt={alt} unoptimized={props.unoptimized ?? true}
    width={width ?? local?.width ?? 640} height={height ?? local?.height ?? 480}/>;
}
