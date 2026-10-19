import { validIntakeRequestKey } from "./project-intake-contract";

export const INTAKE_ATTEMPT_KEY = "arkem-intake-attempt-v1";
export const INTAKE_ATTEMPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export type IntakeAttempt = { schema: "ARKEM-INTAKE-ATTEMPT/1.0"; payloadDigest: string; key: string; createdAt: number };
const limits: Record<string, number> = { name: 120, company: 160, email: 180, phone: 60, location: 160, buildingType: 120, area: 80, stage: 120, requestType: 160, message: 20000, consent: 20, website: 200 };
async function digest(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}
// Only a digest and retry identity are stored, never contact details, file names or bytes.
export async function intakePayloadDigest(form: FormData) {
  const fields = Object.entries(limits).map(([key, limit]) => [key, String(form.get(key) || "").trim().slice(0, limit)]);
  const files = await Promise.all(form.getAll("projectFiles").filter((value): value is File => value instanceof File && value.size > 0).map(async file => [
    file.name.replace(/[\\/\u0000-\u001f\u007f]/g, "-").replace(/\s+/g, " ").trim().slice(0, 160) || "proje-dosyasi",
    file.size, await digest(await file.arrayBuffer()),
  ]));
  files.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return digest(new TextEncoder().encode(JSON.stringify({ fields, files })).buffer);
}
export function resolveIntakeAttempt(value: unknown, payloadDigest: string, now = Date.now(), createKey = () => crypto.randomUUID()): IntakeAttempt {
  if (!/^[a-f0-9]{64}$/.test(payloadDigest)) throw new Error("Invalid payload digest");
  const previous = value && typeof value === "object" ? value as Partial<IntakeAttempt> : null;
  if (previous?.schema === "ARKEM-INTAKE-ATTEMPT/1.0" && previous.payloadDigest === payloadDigest && typeof previous.key === "string" && validIntakeRequestKey(previous.key)
    && typeof previous.createdAt === "number" && Number.isFinite(previous.createdAt) && previous.createdAt <= now + 60000 && now - previous.createdAt <= INTAKE_ATTEMPT_MAX_AGE_MS) {
    return { schema: previous.schema, payloadDigest, key: previous.key, createdAt: previous.createdAt };
  }
  return { schema: "ARKEM-INTAKE-ATTEMPT/1.0", payloadDigest, key: createKey(), createdAt: now };
}
