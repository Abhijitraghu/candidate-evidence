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
3. Click **Extract requirements**. Check each requirement and its supporting JD quote. Edit wording, add missing requirements, remove irrelevant ones, and select the must-haves. Blank requirements prevent confirmation.
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
- Every displayed CV quote is checked against the extracted CV text, case-sensitively. Claims with invalid quotes become **Needs checking**. Matching quotes do not prove the AI's interpretation is correct; the recruiter test checks that.
- `test-cvs/`, `.env*`, installed packages, build output, test output, and local screenshots are ignored by git. Local checks and screenshots containing CV data must stay in those ignored folders.

## Checks

```sh
npm test
npm run build
npm run test:browser
```

Current handoff: see NEXT_STEPS.md. Live OpenAI assessment is awaiting API credits. The separate simulated-screen checks pass; they are not a live AI pass.

The live browser check uses installed Google Chrome and the real `test-cvs/JD.pdf` plus the first `.docx` in that folder. It makes two real OpenAI calls, so the dev key and OpenAI billing must be ready. It checks confirmation, edits, quote fidelity, uncertainty about communication, and recovery from an unreadable replacement. It skips when the private test files are absent. It does not record document contents in committed fixtures, traces, or screenshots.

To check uploads and the review screen without paid AI calls, run `npx playwright test can-read-and-review-documents.spec.ts`. These checks use synthetic action responses and also verify parsing of all private Word CVs.

## Agreed limits

- The recruiter test runs alongside the build.
- Milestone 1 is the first semicolon-separated milestone in PRODUCT.md: one JD, confirmed requirements, evidence for one CV.
- Scores, multi-candidate ranking, recruiter flags and overrides, PDF reports, private accounts, and persistence belong to later milestones.
- Missing evidence is uncertainty. This tool does not verify claims, prove culture fit, detect fraud, recommend hiring, or automatically reject anyone.
- Commits are local. Nothing is pushed to GitHub or deployed to production automatically.
