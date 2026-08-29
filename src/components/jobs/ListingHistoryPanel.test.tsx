import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import ListingHistoryPanel from "./ListingHistoryPanel.tsx";
import type { Job } from "../../types.ts";

test("renders every folded source ID as its own LinkedIn link", () => {
  const job = {
    job_id: "4437408751",
    location: "Canada",
    seen_count: 2,
    posting_wave_count: 1,
    repost_count: 0,
    listing_instances: [
      { job_id: "4430494163", location: "Canada", scraped_at: "2026-06-19", posted_at: "2026-06-18", posted_relative_text: null, applicant_count: null, salary_text: null, recruiter_name: null, recruiter_profile_url: null, recruiter_identifier: null },
      { job_id: "4437408751", location: "Canada", scraped_at: "2026-07-07", posted_at: "2026-07-06", posted_relative_text: null, applicant_count: null, salary_text: null, recruiter_name: null, recruiter_profile_url: null, recruiter_identifier: null },
    ],
  } as Job;

  const html = renderToStaticMarkup(<ListingHistoryPanel job={job} />);

  assert.match(html, /href="https:\/\/www\.linkedin\.com\/jobs\/view\/4430494163"/);
  assert.match(html, /href="https:\/\/www\.linkedin\.com\/jobs\/view\/4437408751"/);
  assert.equal((html.match(/target="_blank"/g) ?? []).length, 2);
});
