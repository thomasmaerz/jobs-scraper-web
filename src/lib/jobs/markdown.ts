export function normalizeJobDescriptionMarkdown(content: string): string {
  return content
    .replace(/\*\*\*\*/g, "**\n\n**")
    .replace(/(\*\*[^*\n]+?)(?: {2}\n\n?|\n{2,})(?=\S)([^*\n]+?\*\*)/g, "$1**\n\n**$2")
    .replace(
    /(\*\*[^*\n]+\*\*)(?=[\p{L}\p{N}])/gu,
    "$1\n\n",
    );
}
