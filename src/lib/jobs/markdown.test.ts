import assert from "node:assert/strict";
import test from "node:test";

import { normalizeJobDescriptionMarkdown } from "./markdown.ts";

test("separates adjacent bold headings emitted by the scraper", () => {
  assert.equal(
    normalizeJobDescriptionMarkdown(
      "**Job Description****What is the opportunity?**As part of the team",
    ),
    "**Job Description**\n\n**What is the opportunity?**\n\nAs part of the team",
  );
});

test("leaves valid markdown unchanged", () => {
  assert.equal(
    normalizeJobDescriptionMarkdown("A paragraph with **bold text** inside."),
    "A paragraph with **bold text** inside.",
  );
});
