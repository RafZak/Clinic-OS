export type ParsedInlineMeta = {
  key: string;
  value: string;
};

export type ParsedMemorySection = {
  heading: string;
  body: string;
};

export type ParsedMemory = {
  title: string;
  inlineMeta: ParsedInlineMeta[];
  intro: string;
  sections: ParsedMemorySection[];
};

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n+/;
const H1_RE = /^#\s+(.+)$/m;
const H2_RE = /^##\s+/m;

export function parseMemoryMarkdown(raw: string): ParsedMemory {
  let body = raw.replace(FRONTMATTER_RE, "");

  const titleMatch = body.match(H1_RE);
  const title = titleMatch?.[1]?.trim() ?? "";
  if (titleMatch) {
    body = body.slice(titleMatch.index! + titleMatch[0].length);
  }

  const firstH2 = body.match(H2_RE);
  const beforeFirstH2 = firstH2 ? body.slice(0, firstH2.index!) : body;
  const fromFirstH2 = firstH2 ? body.slice(firstH2.index!) : "";

  const inlineMeta: ParsedInlineMeta[] = [];
  const inlineRe = /\*\*([^*\n]+?)\*\*\s*[:：]\s*([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = inlineRe.exec(beforeFirstH2)) !== null) {
    const key = m[1].trim();
    const value = m[2].trim();
    if (key && value) inlineMeta.push({ key, value });
  }

  const inlineRe2 = /\*\*([^*\n]+?)\*\*\s*[:：]\s*([^\n]+)/g;
  const introWithoutMeta = beforeFirstH2
    .replace(inlineRe2, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const sections: ParsedMemorySection[] = [];
  if (fromFirstH2) {
    const chunks = fromFirstH2.split(/(?=^##\s+)/m);
    for (const chunk of chunks) {
      const sm = chunk.match(/^##\s+(.+?)\r?\n([\s\S]*)$/);
      if (sm) {
        const heading = sm[1].trim();
        const sectionBody = sm[2].replace(/^\s+|\s+$/g, "");
        if (sectionBody.length > 0) {
          sections.push({ heading, body: sectionBody });
        }
      }
    }
  }

  return { title, inlineMeta, intro: introWithoutMeta, sections };
}
