import { canonicalizeArchetype } from "../../lib/archetypes/registry.ts";

const DEFAULT_ARCHETYPE = "technology_delivery";

export function normalizeInsightsArchetype(
  archetypeParam: string | string[] | undefined,
) {
  const candidate =
    typeof archetypeParam === "string"
      ? archetypeParam
      : Array.isArray(archetypeParam)
        ? archetypeParam[0]
        : undefined;

  const normalized = candidate?.trim();

  return normalized ? canonicalizeArchetype(normalized) : DEFAULT_ARCHETYPE;
}
