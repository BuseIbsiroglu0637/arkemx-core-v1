/** Spreadsheet-safe, quoted UTF-8 CSV. Numbers remain numbers, formula-like text remains text. */
export function createSafeCsv(rows: readonly (readonly unknown[])[], delimiter = ",") {
  if (delimiter !== "," && delimiter !== ";") throw new Error("Unsupported CSV delimiter");
  return "\uFEFF" + rows.map(row => row.map(value => {
    let text = value == null ? "" : String(value);
    if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(delimiter)).join("\r\n");
}
