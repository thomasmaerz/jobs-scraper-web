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

test("repairs RELQ headings without corrupting inline bold phrases", () => {
  const source = "**Job Title: IT Agile Project Manager with AWS****Location: Remote  \n\nDuration: 12+ Months (Contract)****Coordination for Release Needed****Client Domain**Product company.\n\n**Job Summary**We need **Jira**, **Confluence**, and **business intelligence (BI) reporting tools** to deliver.";

  assert.equal(
    normalizeJobDescriptionMarkdown(source),
    "**Job Title: IT Agile Project Manager with AWS**\n\n**Location: Remote**\n\n**Duration: 12+ Months (Contract)**\n\n**Coordination for Release Needed**\n\n**Client Domain**\n\nProduct company.\n\n**Job Summary**\n\nWe need **Jira**, **Confluence**, and **business intelligence (BI) reporting tools** to deliver.",
  );
});

test("does not pair adjacent closing and opening inline delimiters", () => {
  assert.equal(
    normalizeJobDescriptionMarkdown("Use **Jira**, **Confluence**, and **Power BI** daily."),
    "Use **Jira**, **Confluence**, and **Power BI** daily.",
  );
});
