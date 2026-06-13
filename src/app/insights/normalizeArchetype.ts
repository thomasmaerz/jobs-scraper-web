const DEFAULT_ARCHETYPE = "software_tpm";

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

  return normalized ? normalized : DEFAULT_ARCHETYPE;
}
