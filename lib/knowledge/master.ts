const MASTER_FILE_PATTERN = /^\s*mas?ter/i;

export function isMasterFile(sourceFile: string | null | undefined): boolean {
  if (!sourceFile) return false;
  return MASTER_FILE_PATTERN.test(sourceFile);
}
