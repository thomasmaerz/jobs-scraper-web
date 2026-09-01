import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/utils/supabase/service";
import type { ScraperConfiguration } from "./types";
import { ConfigurationConflictError, isConfigurationRevisionConflict } from "./conflict";

export async function getScraperConfiguration(): Promise<ScraperConfiguration> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("get_scraper_configuration");
  if (error) throw new Error(`Could not load scraper configuration: ${error.message}`);
  return data as ScraperConfiguration;
}

export async function replaceScraperConfiguration(
  configuration: ScraperConfiguration,
  actor: User,
): Promise<ScraperConfiguration> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("replace_career_lane_configuration", {
    p_configuration: configuration,
    p_expected_revision: configuration.revision,
    p_actor_id: actor.id,
    p_actor_email: actor.email ?? null,
  });
  if (error && isConfigurationRevisionConflict(error)) throw new ConfigurationConflictError();
  if (error) throw new Error(`Could not save scraper configuration: ${error.message}`);
  return data as ScraperConfiguration;
}
