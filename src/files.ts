// Lecture des fichiers déposés / collés. Tout reste en mémoire, rien n'est écrit sur le disque.
import type { Attachment } from "./providers";
import { extOf } from "./reactions";

const TEXT_EXT = new Set([
  "txt", "md", "csv", "tsv", "json", "xml", "yaml", "yml", "ini", "log", "html", "htm", "css", "js", "ts", "tsx", "jsx", "py", "rs", "ps1", "psm1", "sh", "bat", "cmd",
  "sql", "cs", "java", "go", "cpp", "c", "h", "php", "rb", "toml", "conf", "cfg", "reg", "inf", "gpo", "adml", "admx", "evtx.txt", "svg", "tex", "rtf",
]);
const IMAGE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export const MAX_TEXT = 300 * 1024;
export const MAX_BIN = 8 * 1024 * 1024;
export const MAX_FILES = 6;

export type ReadResult = { ok: true; att: Attachment } | { ok: false; name: string; reason: string };

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export async function readFile(file: File): Promise<ReadResult> {
  const name = file.name || "collé";
  const ext = extOf(name);
  const mime = file.type || "";
  try {
    if (IMAGE.has(mime)) {
      if (file.size > MAX_BIN) return { ok: false, name, reason: "image trop lourde (8 Mo max)" };
      return { ok: true, att: { name, mime, kind: "image", size: file.size, data: await toBase64(file) } };
    }
    if (mime === "application/pdf" || ext === "pdf") {
      if (file.size > MAX_BIN) return { ok: false, name, reason: "PDF trop lourd (8 Mo max)" };
      return { ok: true, att: { name, mime: "application/pdf", kind: "pdf", size: file.size, data: await toBase64(file) } };
    }
    if (mime.startsWith("text/") || TEXT_EXT.has(ext) || mime === "application/json" || mime === "application/xml") {
      if (file.size > MAX_TEXT) return { ok: false, name, reason: "fichier texte trop gros (300 Ko max)" };
      return { ok: true, att: { name, mime: mime || "text/plain", kind: "text", size: file.size, text: await file.text() } };
    }
    return { ok: false, name, reason: `format .${ext || "?"} non pris en charge (texte, code, image, PDF)` };
  } catch {
    return { ok: false, name, reason: "lecture impossible" };
  }
}
