export const CANONICAL_ARCHETYPES = [
  "technology_delivery",
  "systems_platform_ops",
  "network_infrastructure",
  "datacenter_operations",
  "ai_workflow_automation",
  "building_controls",
] as const;

export type CanonicalArchetype = (typeof CANONICAL_ARCHETYPES)[number];

export const ARCHETYPE_ALIASES = {
  software_tpm: "technology_delivery",
} as const satisfies Readonly<Record<string, CanonicalArchetype>>;

export type LegacyArchetypeAlias = keyof typeof ARCHETYPE_ALIASES;

export interface ArchetypeRegistryEntry {
  archetype: CanonicalArchetype;
  label: string;
  shortLabel: string;
  description: string;
}

export const ARCHETYPE_REGISTRY: Readonly<Record<CanonicalArchetype, ArchetypeRegistryEntry>> = {
  technology_delivery: {
    archetype: "technology_delivery",
    label: "Technology Delivery",
    shortLabel: "Delivery",
    description: "Technology project, program, delivery, and implementation management.",
  },
  systems_platform_ops: {
    archetype: "systems_platform_ops",
    label: "Systems & Platform Operations",
    shortLabel: "Systems & Platforms",
    description: "Systems, compute, virtualization, identity, storage, OS, and platform operations.",
  },
  network_infrastructure: {
    archetype: "network_infrastructure",
    label: "Network Infrastructure",
    shortLabel: "Networks",
    description: "Routing, switching, wireless, WAN/VPN, firewall, and network operations.",
  },
  datacenter_operations: {
    archetype: "datacenter_operations",
    label: "Datacenter Operations",
    shortLabel: "Datacenter",
    description: "Physical datacenter, server hardware, cabling, deployment, and lifecycle work.",
  },
  ai_workflow_automation: {
    archetype: "ai_workflow_automation",
    label: "AI Workflow Automation",
    shortLabel: "AI Automation",
    description: "Applied AI, LLM, agentic, and low-code business workflow automation.",
  },
  building_controls: {
    archetype: "building_controls",
    label: "Building Controls",
    shortLabel: "Controls",
    description: "PLC/HMI/SCADA, BAS/BMS, commissioning, and controls integration.",
  },
};

export function isCanonicalArchetype(value: string): value is CanonicalArchetype {
  return (CANONICAL_ARCHETYPES as readonly string[]).includes(value);
}

export function canonicalizeArchetype(value: string): string {
  const normalized = value.trim().toLowerCase();
  return ARCHETYPE_ALIASES[normalized as LegacyArchetypeAlias] ?? normalized;
}

/**
 * Returns database values that preserve matches stored under a legacy alias.
 * New writes should always use canonicalizeArchetype instead.
 */
export function compatibleArchetypeValues(values: readonly string[]): string[] {
  const expanded = new Set<string>();
  for (const value of values) {
    const canonical = canonicalizeArchetype(value);
    expanded.add(canonical);
    for (const [alias, target] of Object.entries(ARCHETYPE_ALIASES)) {
      if (target === canonical) expanded.add(alias);
    }
  }
  return [...expanded];
}

export function archetypeLabel(value: string): string {
  const canonical = canonicalizeArchetype(value);
  return isCanonicalArchetype(canonical)
    ? ARCHETYPE_REGISTRY[canonical].label
    : value.replaceAll("_", " ");
}
