export type VaultMetadata = {
  type?: string;
  entity_id?: string;
  center?: string;
  sessions_analyzed?: number;
  avg_score?: number;
  trend?: "improving" | "stable" | "declining";
  updated_at?: string;
  // Champs spécifiques pattern :
  severity?: "info" | "warning" | "critical";
  first_detected?: string;
  occurrences?: number;
  // Champs spécifiques session :
  session_id?: string;
  global_score?: number;
  patient?: string;
  practitioner?: string;
  date?: string;
  duration_seconds?: number;
  [key: string]: string | number | undefined;
};

export type ParsedVaultFile = {
  metadata: VaultMetadata;
  content: string;
};

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export function parseFrontmatter(raw: string): ParsedVaultFile {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { metadata: {}, content: raw };
  }
  const yamlBlock = match[1];
  const content = raw.slice(match[0].length);
  const metadata = parseYamlScalars(yamlBlock);
  return { metadata, content };
}

export function serializeFrontmatter(metadata: VaultMetadata, content: string): string {
  const yaml = serializeYamlScalars(metadata);
  if (!yaml) return content;
  return `---\n${yaml}\n---\n${content.startsWith("\n") ? "" : "\n"}${content}`;
}

function parseYamlScalars(block: string): VaultMetadata {
  const out: VaultMetadata = {};
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const valueRaw = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    if (!valueRaw) {
      out[key] = "";
      continue;
    }
    const intMatch = /^-?\d+$/.test(valueRaw);
    if (intMatch) {
      out[key] = Number.parseInt(valueRaw, 10);
      continue;
    }
    const floatMatch = /^-?\d+\.\d+$/.test(valueRaw);
    if (floatMatch) {
      out[key] = Number.parseFloat(valueRaw);
      continue;
    }
    const stripped = stripQuotes(valueRaw);
    out[key] = stripped;
  }
  return out;
}

function stripQuotes(s: string): string {
  if (
    (s.startsWith("\"") && s.endsWith("\"")) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function serializeYamlScalars(metadata: VaultMetadata): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "number") {
      lines.push(`${key}: ${value}`);
      continue;
    }
    if (typeof value === "string") {
      // Quote if contains special chars or starts with [
      if (
        value === "" ||
        /[:#&*!|>'"%@`,\[\]\{\}]/.test(value) ||
        /^\s|\s$/.test(value)
      ) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
  }
  return lines.join("\n");
}

export function mergeMetadata(
  current: VaultMetadata,
  diff: Partial<VaultMetadata>
): VaultMetadata {
  const out: VaultMetadata = { ...current };
  for (const [key, value] of Object.entries(diff)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}
