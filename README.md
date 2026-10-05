# Candidate evidence — milestone 1

Upload one job description, confirm or correct its requirements and must-haves, then inspect exact CV evidence for one candidate. There is no ranking, shortlist, export, account setup, or save/reopen flow in this milestone.

## Run locally

From `/Users/admin/build-sprint-app`:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. `.env.local` must contain your development `CONVEX_URL` (the public `.convex.cloud` deployment address). Only that address is exposed to the browser; no OpenAI key belongs in this file.

If you change backend code, run `npm run backend` in another terminal, or `npx convex dev --once` to update it once. Starting the frontend does not update backend code automatically.

## Configure OpenAI

Use the Convex dashboard's **Settings → Environment Variables** for the selected deployment. Add the variable **OPENAI_API_KEY** separately to both **development** and **production**. The variable name is identical on both deployments; the value can be a different key for each.

Never put this key in frontend code, a `VITE_` variable, a committed file, or a shell command you share. Do not paste it into chat. The `convex/assessment.ts` actions read `process.env.OPENAI_API_KEY` only on the server. The development backend currently uses `gpt-4.1-mini`. The production app is not deployed in milestone 1.

## Check with your private files

1. Choose **test-cvs/JD.pdf** as the job description.
2. Open **Read extracted text** and compare it with the original JD.
3. Click **Extract requirements**. Check each requirement and its supporting JD quote. Edit wording, add missing requirements, remove irrelevant ones, and select the must-haves. Blank requirements prevent confirmation. Different experience ranges in the JD appear as a warning that must be reviewed before confirmation; acknowledging it does not resolve the conflict.
4. Click **Confirm requirements**. The CV upload appears only after this step.
5. Choose one `.docx` CV from **test-cvs/**, then click **Assess this CV**.
6. Check the evidence row for every confirmed requirement. Click **See this quote in the CV** to highlight its exact location in the extracted text. Compare a few quotes against the original file too.
7. Check that missing evidence is described as **Not found in CV** or **Needs checking**, rather than proof the candidate lacks a skill. Communication and culture fit must be checked in a recruiter call.
8. Click **Edit requirements**. The previous report disappears and assessment remains unavailable until you confirm again.
9. Replace the CV with an unreadable file: an error should explain what to do, and the old candidate's report must disappear. Try another readable file to recover.

PDFs must have readable text. Image-only/scanned pages and password-protected PDFs are rejected. Word support is `.docx`; save older `.doc` files as `.docx` first. Maximum file size is 10 MB, extracted text is limited to 80,000 characters, PDFs to 100 pages, and a role to 40 requirements. No text is silently truncated.

## What is saved or sent

- Files and working results stay in memory in the current browser tab. Refreshing clears them.
- File text is sent through Convex to OpenAI when you extract requirements or assess a CV. The raw files are not uploaded to Convex storage.
- The agent is configured not to save prompt/output messages. OpenAI requests use `store: false`; provider retention policies still apply.
- A shared request counter, containing no document text, limits this development demo to 30 paid AI requests per hour. There are no private accounts in this milestone; use locally for testing.
- Every displayed CV quote is checked against the extracted CV text, case-sensitively. The AI selects numbered original passages; the server supplies the unchanged quotes. Missing answer rows, unmatched quotes and evidence claims without quotes have separate **Needs checking** explanations. Only failed rows get one bounded repair attempt; each paid attempt counts against the request limit. If every row fails, the screen says the assessment is incomplete rather than presenting a zero-evidence assessment. Matching quotes do not prove the AI's interpretation is correct; the recruiter test checks that.
- `test-cvs/`, `.env*`, installed packages, build output, test output, and local screenshots are ignored by git. Local checks and screenshots containing CV data must stay in those ignored folders.

## Checks

```sh
npm test
npm run build
npm run test:browser
```

Current handoff: see NEXT_STEPS.md. Credits work and the live AI checks pass. Interpretation quality still needs recruiter review; passing quote checks does not prove a correct assessment.

Browser tests start their own local server on port 5174. The live browser check uses installed Google Chrome and the real `test-cvs/JD.pdf` plus the first `.docx` in that folder. It normally makes two real OpenAI calls, plus at most one repair call for failed assessment rows, so the dev key and OpenAI billing must be ready. It checks confirmation, edits, quote fidelity, uncertainty about communication, and recovery from an unreadable replacement. It skips when the private test files are absent. It does not record document contents in committed fixtures, traces, or screenshots.

To check uploads and the review screen without paid AI calls, run `npx playwright test can-read-and-review-documents.spec.ts`. These checks use synthetic action responses and also verify parsing of all private Word CVs.

## Evidence and requirement checks

- The extractor considers responsibilities as well as skills and qualifications. Original bullets under recognized section headings and labeled experience lines are checked for coverage. Uncovered lines are restored with their original quote and a review note. Unusual JD formats still need manual review.
- Independent tools in lists are separated. The JD's different experience ranges remain visible for recruiter clarification.
- Strong knowledge and analytical quality are treated as partial evidence when a CV claims related skills or tasks. Communication quality and culture fit always need checking.
- Month-based job dates are counted with overlaps merged. Education dates are excluded. Dates near a range boundary remain uncertain, and an out-of-range duration prompts clarification rather than an automatic rejection.
- Specific DLP, Azure, MDM/Intune and application-support claims are checked for explicit mentions in the selected passages. Exact quotes still do not guarantee correct interpretation of other tasks.
- Diagnostics are returned to the current caller only, including text length and the failed-row reason; document and output text are not logged or saved in Convex tables.
- The normal request limit remains 30 per hour. For an authorized development verification run, `AI_TEST_REQUEST_LIMIT` can temporarily raise it to at most 60. Remove that development variable after testing. It is not configured in production.

## Agreed limits

- The recruiter test runs alongside the build.
- Milestone 1 is the first semicolon-separated milestone in PRODUCT.md: one JD, confirmed requirements, evidence for one CV.
- Scores, multi-candidate ranking, recruiter flags and overrides, PDF reports, private accounts, and persistence belong to later milestones.
- Missing evidence is uncertainty. This tool does not verify claims, prove culture fit, detect fraud, recommend hiring, or automatically reject anyone.
- Commits are local. Nothing is pushed to GitHub or deployed to production automatically.

## Milestone 2 recommendations

The recruiter confirms one JD, its must-haves and explicit CV phrase rules before assessment. A semicolon separates required phrase groups; `/` separates equivalent phrases within a group. All groups must match for full evidence. Draft aliases cover the current service-desk JD; other wording requires recruiter review. CV classification uses `shared/recommendation.ts` in the real Convex action `assessment:recommendCandidate`, without AI calls, cached AI judgments or document persistence. The older milestone 1 AI action remains available for diagnostics but is no longer used by the app.

Full evidence earns 1 point; partial evidence earns 0.5. Communication, culture, personality and analytical quality are drafted as call-only checks, excluded from coverage and must-have gates. Move to next round requires all CV-checkable must-haves plus at least 80% coverage. Missing CV evidence or an explicit negative claim for a must-have means Not now; other uncertainty means Maybe. These labels support recruiter review, never automatic rejection. Phrase matches establish documented claims, not proficiency. Different phrasing can be missed. Unknown requirements initially use their literal text and must be adjusted before confirmation.

Exact CV lines and original character offsets accompany every evidence claim. Limited/learning/negative language remains partial or conflicting. Date calculations merge overlapping month intervals, exclude education lines, and use the explicitly confirmed assessment month for Present. Same CV text, confirmed rules, assessment month and rule version produce identical complete outputs. JD extraction can still vary; confirm and keep one requirement list for comparisons. Conflicting experience ranges must be edited before confirmation.

CVs can be assessed sequentially and remain visible in the current session. Each recommendation retains reasons and missing must-haves. Recruiter choices and notes are separate from the original app recommendation. Changing the JD or reopening requirement editing clears recommendations and choices for fresh review. Refresh clears this session; durable saving is a later milestone. Unreadable CVs remain visible as Unable to assess.

### Recruiter-approved rule update (5 October 2026)

Rule version 2.1.0 accepts `ITIL`, `ITSM` or `incident management` for ITIL familiarity. Communication and analytical troubleshooting quality are marked Check on recruiter call, with mustHave false, and excluded from coverage and recommendation gates. Specific JD troubleshooting tasks remain CV requirements. The recruiter chose 1–7 years: draft review keeps that range and removes the conflicting 1–3-year row when both appear, preserving original source quotes on retained requirements. Confirmed rules remain editable.

## Publish with Convex static hosting

Run `npm run deploy` to build the frontend against the production backend, deploy Convex functions and upload the static files to the production `.convex.site` address. GitHub pushes do not deploy the app. Hosting uses `@convex-dev/static-hosting` mounted at `/`; app-owned HTTP routes use `/api`. Upload functions are internal and require Convex CLI authentication.

The production Convex environment needs `OPENAI_API_KEY` for JD extraction. Keep this key in Convex settings, never in frontend code or GitHub. Development continues with `npm run dev` and `npm run backend`. `VITE_CONVEX_URL` supplied by the deployment command takes priority over the local public `CONVEX_URL` fallback.
