// Rendu Markdown minimal et sûr : tout est échappé d'abord, puis on remet un peu de mise en forme.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  return s
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

export function renderMarkdown(src: string): string {
  const parts = src.split(/```/);
  let out = "";
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf("\n");
      const lang = nl >= 0 ? part.slice(0, nl).trim() : "";
      const code = nl >= 0 ? part.slice(nl + 1) : part;
      out += `<pre data-lang="${esc(lang)}"><button class="copy" type="button">Copier</button><code>${esc(code.replace(/\n$/, ""))}</code></pre>`;
      return;
    }
    const lines = esc(part.replace(/^\n+|\n+$/g, "")).split("\n");
    let list: "ul" | "ol" | null = null;
    const close = () => { if (list) { out += `</${list}>`; list = null; } };
    for (const line of lines) {
      const ul = /^\s*[-*•]\s+(.*)/.exec(line);
      const ol = /^\s*\d+[.)]\s+(.*)/.exec(line);
      const h = /^(#{1,4})\s+(.*)/.exec(line);
      if (ul || ol) {
        const kind = ul ? "ul" : "ol";
        if (list !== kind) { close(); out += `<${kind}>`; list = kind; }
        out += `<li>${inline((ul ?? ol)![1])}</li>`;
      } else {
        close();
        if (h) out += `<p class="h">${inline(h[2])}</p>`;
        else if (line.trim() === "") out += "<br>";
        else out += `<p>${inline(line)}</p>`;
      }
    }
    close();
  });
  return out.replace(/(<br>){2,}/g, "<br>");
}
