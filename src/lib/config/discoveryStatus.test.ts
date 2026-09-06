import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../../app/api/config/status/route.ts", import.meta.url),
  "utf8",
);
const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
const client = readFileSync(
  new URL("../../components/config/ConfigClient.tsx", import.meta.url),
  "utf8",
);

test("discovery status uses a no-store service-role API", () => {
  assert.match(repository, /get_linkedin_discovery_status/);
  assert.match(route, /getLinkedInDiscoveryStatus\(\)/);
  assert.match(route, /Cache-Control": "no-store, private/);
});

test("configuration UI distinguishes terminal coverage from page limits", () => {
  assert.match(client, /LinkedIn discovery coverage/);
  assert.match(client, /verified no-results evidence/);
  assert.match(client, /Baseline pages per query/);
  assert.doesNotMatch(client, /Maximum result pages requested/);
});
