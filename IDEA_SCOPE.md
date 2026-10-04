IDEA LOCK · Build Sprint
The idea, in one line: AI-native talent and recruitment delivery to
1. Hire the best possible candidate
2. Reduce hiring time from 30 days to 4 hours.
Why me (at least 1 of 3: an audience that trusts me, years inside the workflow, data nobody else has): 
1. I have faced this problem myself i.e I’ve literally lost money/revenue
2. I know many people looking to recruit and tell me that it is the hardest thing to do. Even apart from getting business.
3. I know the workflow and know exactly what and where the automation can be done.
GOAL
The one goal they hire it for (money, time, status or life):
Time -> For sure. If I can get them candidates with a near-perfect fitment + reduce time to hire
Delta 4 (the steps today → the steps with my product):
Steps today - Get a requirement -> Write a JD -> Get it approved -> Float the JD in channels/ Social Media -> Receive profiles -> Screen them on ATS -> Screen them manually -> Do a phone call -> Do an interview with hiring manager -> Decide on how to proceed. If yes, move onto next rounds. If no, send rejection message. This takes at least 15 days
Steps through me (Delta 4) Get AI to write the JD based on 2-3 sentences -> Find candidates on the platform immediately -> See a fitment report (communication, technical and cultural fitments) -> Same report is sent to hiring manager who knows what to expect -> Block time automatically based on calendar integration with hiring manager -> Decide next steps
The sin it rides (optional): Not sure which sin is my problem solving for
USER
The trigger (when the pain hits): 1. When someone resigns and the JD needs to be put out 2. When hiring needs to start happening 3. When there is a deadline to hire someone (quality is foregone here)
Today's path, step by step (including not solving it at all): Already mentioned earlier I think. Not solving with my AI-based approach will make it difficult to fulfil positions on time.
Who they trust on this decision: Not sure what this means
Would they pay? (what exists today that people pay for): Absolutely, it costs a lot of money to hire a single candidate. So reducing that on a subscription will be a much better bet.
PRODUCT
Onboarding (how a first-time user feels the value fastest): By putting in his asks in a chat and getting profiles immediately. The profiles will have an AI-interview with a report on fitment as well.
The core loop (user stories, written by me): See the openings and if more than 100 people have applied, it makes sense for an AI to take over and do the initial end to end screening before sending to the hiring manager
Coming back (optional): Each time they have new requirements
The AI-first part (onboarding, engagement or the core loop): Core loop actually - because I want them to see value and keep coming back
MARKET
Tailwinds (where funding is going, what Google Trends shows, timing): Not sure how much funding is going in here, but there are tailwinds in this sector. Lots of people are looking at AI-based voice and video interviews. But something end to end doesn’t exist.
Competitors (and the flows I liked, with screenshots and why): Biggest Compeititor is Keystone AI by Cornerstone Group. But their’s is a very early stage competitor and does not have any users. Other competitors include Flowmingo (for reports) and AI interviews.
Challenges with Keystone
1. Does not give me a report like flowmingo on skills.
2. Background verification isn’t done properly
3. Does not give me details on notice period and other things - Not sure how fitment is calculated wither
4. Copied everything from LinkedIn
5. No way to assess skills apart from interviewing directly.
Size and fit (how many people in my extended network fit):
The following are the key challenges recruiters face and what it looks like with AI

For the first one, I know 25 recruiters and will have 3 by Monday.

Shaktimaan, this is what I have thought about user, product and market. Lock it in.

## What v1 does

These agreed sections define the current build where they differ from the original vision above. The broader vision remains a direction for v2; its features will be scoped after testing v1.

The core action: a recruiter uploads a job description (JD) and applicants' CVs, then gets a ranked comparison and a fitment report backed by exact quotes from each candidate's own CV. The aim is to reduce reading, comparison, and explanation work and help the recruiter choose whom to call.

- First user: Damodar, who shortlists for Sandeep, the hiring manager for CWS APAC. Other first testers: Shiva and Sanuj.
- Accept PDF and Word files for the JD and CVs. Support up to 500 CVs per opening, uploaded in batches.
- Extract the JD requirements and must-haves. The recruiter confirms or corrects them before scoring, including specific requirements missing from the JD.
- Rank every readable CV against the confirmed requirements. Give each requirement equal weight and show the scoring breakdown.
- Display a percentage match score with two decimal places. This measures documented fit against requirements, not the probability of succeeding in the job. A near-complete documented match should score around 95–100%; a partial match may score around 75%, depending on the evidence.
- Support score explanations with exact CV quotes. Mark unsupported requirements as "not found in CV" or "needs checking"; missing evidence does not prove that a candidate lacks a skill.
- Recommend an initial threshold of 80% or higher, which the recruiter can change. Candidates must also have CV evidence for every must-have to enter the recommended shortlist, regardless of overall score.
- Show counts for total uploaded, successfully scored, unreadable, recommended, shortlisted, and flagged CVs. Flag unreadable files for re-upload and continue assessing the others.
- Communication and culture fit need a recruiter call. Provide questions to check these and other unsupported requirements; do not present them as proven by the CV.
- Save CVs, reports, progress, and decisions in a private account, with a delete option. Preserve progress so interrupted uploads or reviews can resume.
- Keep the app's recommendation separate from the recruiter's saved choice. Each candidate starts as "not reviewed" and can be marked "shortlisted" or "not shortlisted."
- If the recruiter explicitly says there are not enough profiles and asks for more, show the next-best candidates from the uploaded CVs below the threshold. Keep scores and must-have gaps visible; the recruiter can then shortlist them manually.
- Put suspected CVs in a separate "Needs verification" bucket. Show who flagged the concern and why, with specific evidence where available. Keep them outside the recommended shortlist until the recruiter reviews and clears the concern, including when more profiles are requested.
- Distinguish suspected profile concerns from errors in the app's quotes or assessment. Allow the recruiter to flag assessment errors for a fresh review while preserving their shortlist decision.
- Provide downloadable PDF fitment reports for shortlisted candidates, including scores, exact CV quotes, gaps, a "Recommended for interview" call to action, and suggested interview questions. The recruiter shares the report with the hiring manager and arranges the interview.

## What v1 does not do

- Write job descriptions.
- Build our own candidate platform, source new candidates, or find profiles beyond the uploaded CVs.
- Conduct AI interviews, voice interviews, or video interviews.
- Book interviews, block calendars, or integrate with calendars.
- Prove communication ability or culture fit from a CV.
- Automatically reject candidates or make the final hiring decision.
- Prove that a profile is fake or perform background verification. Suspicion is a reason to check, not a finding of fraud.
- Promise that CV screening alone reduces the full hiring process from 30 days to four hours.

V2 should expand the product after v1 is tested with real recruiters. JD writing, candidate sourcing or a platform, AI interviews, and calendar booking remain possible future directions, not approved v2 commitments yet.

## Riskiest assumption

The riskiest assumption is that a CV-backed ranking surfaces the candidates Damodar would want to call and saves him meaningful work. If the ranking misses strong applicants, invents evidence, or takes as much effort to check as reading the CVs himself, the product loses its value.

Run a 30-minute test before writing code:

1. Use one real JD and 10 real applicant CVs from Damodar's hiring workflow.
2. Have Damodar confirm the requirements and must-haves, then record whom he would call and why, before showing him a proposed ranking.
3. Prepare a sample ranking and fitment reports using those same requirements, with scores, exact CV quotes, missing evidence, and screening-call questions.
4. Ask Damodar to compare the ranking with his picks, check the quotes, identify missed strong applicants, and judge whether reviewing the reports would save him work.

Evidence to proceed: Damodar finds the recommended candidates worth calling, can verify the reasoning from the CV quotes, and finds the reports faster to review than doing his usual comparison. If the test fails, adjust the scoring or report before building. Repeat with Shiva and Sanuj to check whether the value extends beyond Damodar.
