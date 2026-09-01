import assert from "node:assert/strict";
import test from "node:test";

import { ConfigurationConflictError, isConfigurationRevisionConflict } from "./conflict.ts";

test("recognizes database concurrency conflicts and exposes reload guidance", () => {
  assert.equal(isConfigurationRevisionConflict({ message: "configuration_revision_conflict" }), true);
  assert.equal(isConfigurationRevisionConflict({ message: "other failure" }), false);
  const error = new ConfigurationConflictError();
  assert.equal(error.code, "configuration_revision_conflict");
  assert.match(error.message, /Reload the latest configuration/);
});
