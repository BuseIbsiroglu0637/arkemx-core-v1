const ascii = (bytes: Uint8Array, start: number, length: number) =>
  new TextDecoder("latin1").decode(bytes.subarray(start, start + length));

const hasBytes = (bytes: Uint8Array, expected: readonly number[]) =>
  expected.every((value, index) => bytes[index] === value);

export function evidenceFileMatchesExtension(extension: string, bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  switch (extension) {
    case "pdf":
      return ascii(bytes, 0, 5) === "%PDF-";
    case "dwg":
      return ascii(bytes, 0, 4) === "AC10";
    case "dxf": {
      const header = ascii(bytes, 0, Math.min(bytes.length, 160)).replace(/\0/g, "");
      return /^(?:AutoCAD Binary DXF|\s*0\s+SECTION)/i.test(header);
    }
    case "ifc": {
      const start = hasBytes(bytes, [0xef, 0xbb, 0xbf]) ? 3 : 0;
      const header = ascii(bytes, start, Math.min(bytes.length - start, 256));
      return /^\s*ISO-10303-21;/i.test(header);
    }
    case "jpg":
    case "jpeg":
      return hasBytes(bytes, [0xff, 0xd8, 0xff]);
    case "png":
      return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "webp":
      return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
    case "mp4":
    case "mov":
      return ascii(bytes, 4, 4) === "ftyp";
    case "xlsx":
    case "zip":
      return hasBytes(bytes, [0x50, 0x4b, 0x03, 0x04])
        || hasBytes(bytes, [0x50, 0x4b, 0x05, 0x06])
        || hasBytes(bytes, [0x50, 0x4b, 0x07, 0x08]);
    default:
      return false;
  }
}
