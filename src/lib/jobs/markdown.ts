export function normalizeJobDescriptionMarkdown(content: string): string {
  return content
    .replace(/\*\*\*\*/g, "**\n\n**")
    .replace(/(\*\*[^*\n]+?\*\*)(?=[\p{L}\p{N}])/gu, "$1\n\n");
}
