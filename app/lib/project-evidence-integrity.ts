export async function evidenceBytesMatch(bytes: ArrayBuffer, expected: { fileSize: number; fileSha256: string }) {
  if (bytes.byteLength !== expected.fileSize || expected.fileSize <= 0 || expected.fileSize > 25_000_000 || !/^[a-f0-9]{64}$/i.test(expected.fileSha256)) return false;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return sha === expected.fileSha256.toLowerCase();
}
