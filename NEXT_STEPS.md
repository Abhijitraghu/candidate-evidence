# Milestone 1 handoff

## Latest fixes and verification — 5 October 2026

- Added distinct reasons for missing answers, unmatched quotes and evidence claims without quotes. All-failed reports now say the assessment is incomplete. Failed rows receive at most one repair attempt.
- Replaced AI-copied quotes with selection of original CV passages. Server-supplied quotes preserve original words and whitespace and still pass exact matching.
- Diagnosed the previously zero-evidence CV: its 4,082 characters were read in full. An instrumented repeat of the old approach exposed three quote-copying failures (omitted words, an invented ellipsis, and joined education lines). The original all-15 failure's raw answers were not retained, so its individual historical causes cannot be recovered.
- Expanded extraction coverage to responsibilities and labeled experience lines; restored uncovered source lines, split independent tools, and added a pre-confirmation warning for different JD experience ranges.
- Added consistent checks for communication, proficiency, DLP/Azure/tool evidence, and experience-date arithmetic. Original CV claims remain unverified claims; no hiring decision is made.
- All 17 unit checks, all four browser checks, the build and the development backend update passed. One earlier review-screen rerun timed out after its upload disappeared; its isolated rerun passed, and tests now use their own local server. The final complete browser suite passed.
- Reran all eight CVs with the final assessment logic. The before/after table uses the same original 15 requirements, while the corrected 28-requirement JD was assessed alongside them in the same calls. All 240 requested rows had no quote-verification or missing-row failures. Private results: `.local-checks/live-before.json`, `.local-checks/live-after.json`, `.local-checks/live-comparison.md`, and `.local-checks/manjunath-diagnosis.json`.
- On the original 15 checks, the previously zero-evidence CV now has 4 found, 7 partial, 2 not found and 2 needing checks. The two remaining checks concern communication and the narrower experience range; quoted job dates indicate about 43 months.
- The direct live browser check of that CV passed exact quotes, highlighting, desktop/mobile width checks and visual inspection. Its corrected-list interpretation differed from the batch (12 versus 16 found out of 28), demonstrating remaining AI judgment variability; recruiter review is still required.
- A bounded development-only request-limit override was used for the paid reruns and removed afterward. The normal 30-call limit remains in place. No CVs, private outputs, screenshots or keys are committed. No push or production deployment was performed.

Next: recruiter review of the saved reports, clarify the JD's experience ranges, and compare judgments and review time. Do not describe milestone 1 as recruiter-validated yet.


## Earlier verification — 5 October 2026

Credits now work. The development backend update, all five evidence-validation tests, all three browser tests (including the previously failing synthetic review screen and the real OpenAI flow), and the build passed. Live assessments also completed for all eight Word CVs against the same 15 extracted requirements. Private detailed results and review findings are saved in `.local-checks/live-results.md` and `.local-checks/live-results.json`, excluded from git.

Quality review found 62 of 120 evidence rows falling back to Needs checking; all 15 rows for one CV did so despite explicit relevant claims. Some accepted interpretations overstate skill strength. Requirement extraction missed separate responsibility details and grouped independent tools. The JD also contains conflicting experience ranges (1–7 and 1–3 years). Recruiter correction/comparison and assessment-quality improvements remain necessary before calling milestone 1 complete. Live desktop screenshot inspected; mobile width checks passed with synthetic responses, but live mobile has not been visually inspected. No GitHub push or production deployment was performed.

Next: review the private report with the recruiter, correct the requirement list, improve evidence extraction and interpretation, then reassess.

## Earlier handoff (historical; billing block below is resolved)

Stopped at the builder's request on 5 October 2026. Milestone 1 is built but **not fully verified with live OpenAI assessment**. OpenAI credits will be added tomorrow. Nothing has been pushed to GitHub or deployed to production.

## Done

- Initialized git on `main` and saved the original scope in commit `9ffabce`.
- Excluded `test-cvs/`, `.env*` (including `.env.local`), PDF/Word documents, installed packages, build output, browser test output, and local screenshots from git. No CVs or API keys are tracked.
- Built the local app: add one JD, read its extracted text, extract or manually add requirements, correct them, mark must-haves, confirm them, then upload and assess one CV.
- Kept CV assessment unavailable until requirements are confirmed. Editing requirements removes the old report and requires fresh confirmation.
- Added evidence rows with exact CV quotes, missing/partial/conflicting evidence, uncertainty, and recruiter-call questions. Clicking a quote highlights it in the extracted CV text and brings it into view.
- Verified every displayed quote against the extracted CV text on the server. Invalid or unsupported quotes become “Needs checking”; missing evidence never proves a candidate lacks a skill.
- Put OpenAI calls in Convex actions. The actions read `process.env.OPENAI_API_KEY`; the frontend receives only the public Convex address. Prompt/output history is disabled and OpenAI requests use `store: false`.
- Added a shared limit of 30 AI requests per hour for this account-free development demo. Only the request counter is saved; no document text is stored in app tables or file storage.
- Tested PDF and Word (.docx) reading with `test-cvs/JD.pdf` and all eight Word CVs. Unreadable replacements clear the previous candidate; older .doc files show conversion instructions. The local server denies requests to `test-cvs/`.
- Checked desktop and phone layouts. Fixed an empty status strip that could cover content while scrolling.
- Added five passing quote-validation checks and browser checks for uploads, confirmation, errors, quote highlighting, and invalidating old results. The review-screen checks use explicitly synthetic responses; they do not prove that OpenAI assessment works.

## Blocked on credits

Convex confirms the development key exists. A server request now reaches OpenAI but returns HTTP 429, indicating a usage or billing limit. No live requirements extraction or complete real candidate assessment has passed yet. Do not describe milestone 1 as complete until the live browser check succeeds.

The required variable is **OPENAI_API_KEY**, set separately in Convex's development and production environment settings. The dev variable is already present. The production variable has not been checked. Never paste a key into chat, frontend code, a VITE_ variable, or a committed file.

## Test next, after adding credits

1. From this project folder, run `npx convex dev --once` to confirm the latest backend code is on the development deployment.
2. Run `npm run dev` and open http://127.0.0.1:5173.
3. Upload `test-cvs/JD.pdf`, inspect the extracted text, and click **Extract requirements**. Compare each requirement and its JD quote with the original. Correct wording, add anything missing, and select must-haves.
4. Click **Confirm requirements**, upload one `.docx` CV from `test-cvs/`, then click **Assess this CV**.
5. Check every evidence claim against its exact CV quote and the original document. Check missing evidence and communication/culture requirements remain uncertain. Quote matching alone does not establish that the interpretation is correct.
6. Change a requirement and confirm that the old report disappears. Confirm again and reassess. Replace the CV with an unreadable file, then recover by choosing a readable one.
7. Run `npm run test:browser`. This includes the live OpenAI check plus the separate simulated-screen and file-reading checks. The live check makes two paid calls; it uses the real JD and the first `.docx` in the ignored folder. Private files must be present or the real-file checks skip.
8. Run `npm test` and `npm run build`. If all checks pass, make the milestone 1 working commit. Do not push without the builder's instruction.
9. Run the recruiter comparison alongside the build, as agreed. Record inaccurate interpretations, missed requirements, and whether this saves review time before extending scope.

To run only the already-working checks without OpenAI charges:

```sh
npm test
npx playwright test can-read-and-review-documents.spec.ts
npm run build
```

## Scope and limits

Milestone 1 means the first semicolon-separated item in PRODUCT.md: one JD, confirmed requirements, evidence for one CV. Ranking, scores, flags, overrides, shortlist exports, private accounts, and save/reopen are later milestones.

Supported files are text-based PDF and Word `.docx`. Convert older `.doc` files first. Scanned/image-only and password-protected PDFs are not supported. Limits are 10 MB per file, 80,000 extracted characters, 100 PDF pages, and 40 requirements. Documents are not silently truncated.

Working files and results live only in the current browser tab. Refreshing clears them. Requirement extraction and assessment send text through Convex to OpenAI; provider retention policies still apply. This is a local development test, with no deployed production website or account privacy flow yet.

See README.md for the complete local checking instructions. Screenshot review was interrupted by the requested stop after the status-strip issue was identified; a fresh visual check of live evidence is part of the next session.

## Milestone 2 completed — 5 October 2026

- Implemented approved three recommendation groups with fixed phrase rules, must-have gates, 80% coverage, exact evidence, explicit missing must-haves, call-only checks, session recruiter overrides and notes.
- Conflicting experience ranges must be resolved in confirmed requirements. Date calculations use a confirmed assessment month. CV classification makes no AI call.
- Two fresh real Convex backend runs on all eight private test-cvs produced deeply identical outputs (every evidence row, quote offset, explanation, coverage and recommendation). Private report: `.local-checks/milestone2-live.md`; full outputs: `.local-checks/milestone2-live.json`.
- Test scenario retains the JD header's 1–7-year range and removes the conflicting preferred 1–3-year row. October 2026 assessment month; 27 requirements with visible draft phrase rules. This is a test scenario, not recruiter approval of the JD ambiguity or matching vocabulary.
- Counts in both runs: Move to next round 0; Maybe 1 (Bhavya); Not now 7. Manjunath's full 4,082 characters read; explicit ITIL phrase evidence missing (ITSM/ServiceNow alone does not establish ITIL).
- 24 unit checks and all 4 browser flows passed, including prior review-screen failure checks, live JD extraction/CV assessment and recruiter override/note controls. Build passed; Convex dev functions pushed. Desktop and phone inspected without horizontal overflow.
- Temporary bounded AI test limit removed; default 30/hour restored. Private CVs and reports remain ignored. No production deploy or git push.
- Next: recruiter independently reviews the draft evidence phrases and shortlist. Repeatability is demonstrated; shortlist accuracy and time savings still require recruiter validation.

## Approved matching update — 5 October 2026

- Recruiter approved ITSM and incident management as alternatives to ITIL; communication and analytical troubleshooting quality moved out of must-haves into recruiter-call checks. Approved experience range is 1–7 years.
- Rule version 2.1.0 implemented in draft rules and requirement review. Specific troubleshooting responsibilities remain assessable; call-only qualities do not affect coverage or recommendations.
- 25 unit tests, all 4 browser tests and build passed; Convex development functions updated.
- Two fresh live backend runs on all eight test-cvs were deeply identical across recommendations, coverage, explanations, quotes and offsets. Counts in each: Move to next round 1 (Nagalakshmi), Maybe 4 (Bhavya, Bhimappa, Hemanth, Manjunath), Not now 3 (Karthik, Kaveri, Madhu).
- Full exact evidence and both outputs: ignored `.local-checks/milestone2-approved-live.md` and `.json`. Previous comparison files retained. No AI budget override needed. No push or production deploy.
- Next: recruiter review of the remaining Microsoft 365, VPN, service-desk and ticketing gaps, with their exact CV evidence.

## Shipped — 5 October 2026

- Public repository created and pushed: https://github.com/Abhijitraghu/candidate-evidence
- Convex static hosting installed and mounted at root. Deploy command: `npm run deploy`; GitHub pushes do not deploy.
- Production app: https://opulent-alligator-318.convex.site; backend: https://opulent-alligator-318.convex.cloud. Production JD extraction key configured privately in Convex environment settings.
- Git history checked before push: private CVs, test-cvs, environment files and private reports absent; no recognizable API keys found. Production private-file paths serve no private content (PDF/report paths 404; environment-file path returns only the app HTML fallback).
- All 25 unit tests, 4 development browser tests and build passed. Real production browser core flow passed with exact quotes, highlights, requirement editing and unreadable replacement handling; phone and desktop inspected.
- Initial deployment stopped because an environment change overlapped the push; rerun with the finalized environment succeeded. Deployed code commit: 47eb7a4.
- Next: use the live app for the recruiter’s independent shortlist comparison. Session-only notes and results still clear on refresh, as planned for milestone 2.
