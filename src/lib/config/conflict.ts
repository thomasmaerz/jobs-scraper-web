export const CONFIGURATION_CONFLICT_CODE = "configuration_revision_conflict";

export class ConfigurationConflictError extends Error {
  readonly code = CONFIGURATION_CONFLICT_CODE;

  constructor() {
    super("This configuration was changed by another administrator. Reload the latest configuration, then reapply your draft changes.");
    this.name = "ConfigurationConflictError";
  }
}

export function isConfigurationRevisionConflict(error: { message?: string; details?: string }): boolean {
  return error.message?.includes(CONFIGURATION_CONFLICT_CODE) === true
    || error.details?.includes(CONFIGURATION_CONFLICT_CODE) === true;
}
