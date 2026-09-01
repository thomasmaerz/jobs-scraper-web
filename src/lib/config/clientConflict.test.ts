import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(
  new URL("../../components/config/ConfigClient.tsx", import.meta.url),
  "utf8",
);

test("conflict handling preserves the draft until the administrator explicitly reloads", () => {
  const conflictStart = client.indexOf("response.status === 409");
  const conflictBranch = client.slice(
    conflictStart,
    client.indexOf("if (!response.ok)", conflictStart),
  );
  assert.match(conflictBranch, /setConflicted\(true\)/);
  assert.doesNotMatch(conflictBranch, /setConfig|setBaseline/);
  assert.match(client, /Reload latest/);
  assert.match(client, /onClick=\{\(\) => void load\(\)\}/);
});
