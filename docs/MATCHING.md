# Job matching

How ATSly scores a resume against a job description. The job match score (0–100) is
separate from the ATS score: one says how well an ATS can read the resume, the other how
well the resume shows what a particular role asks for. The engine is `src/lib/matching`
(version `MATCH_ENGINE_VERSION`, stored on every scan); the design is in
[PLANNING.md](PLANNING.md) §19.

## 1. Reading the job description

The posting is normalized and split into segments (responsibilities, requirements,
preferred qualifications, benefits, about the company). Rules then extract:

- **Hard skills and tools** found through the skills taxonomy (about 280 skills with their
  aliases), marked _required_ or _preferred_ by the segment they appear in.
- **Soft skills**, **certifications**, and **responsibilities** (the duty bullets).
- **Years of experience**, including ranges like "2–4 years", taking the smallest minimum.
- **Education level and field**, ignoring look-alikes such as "MS Excel" or "Scrum Master".
- **Job title and seniority**.

With AI available, the posting is also read by the model (cached per posting) and the two
results are merged: rules win on numbers, AI adds skills the taxonomy missed, normalized to
taxonomy names so they can match aliases.

## 2. Matching requirements

Each required or preferred skill and certification is looked for in three tiers, in order:

| Tier         | How                                                                                    | Credit                                                                       |
| ------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Exact        | The term appears in the resume (word boundaries, case-insensitive)                     | 1                                                                            |
| Related term | A taxonomy alias appears, for example "JS" for JavaScript or "K8s" for Kubernetes      | 1                                                                            |
| AI           | The model judged the requirement covered and quoted the resume; the quote was verified | 1 if "yes" with high confidence; ½ if partial or medium confidence; 0 if low |

Certifications only match by name or alias: a certification is held or not. Soft skills are
shown when found but never listed as missing, because they are demonstrated rather than
listed. Every match carries its evidence: the quoted text and where it is, for example
"Experience › Northwind Payments › bullet 2".

## 3. Components and weights

| Component                  | Weight | Score                                                                                                                                                                    |
| -------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Required skills & tools    |     40 | Credit earned ÷ required skills                                                                                                                                          |
| Preferred skills           |     10 | Credit earned ÷ preferred skills                                                                                                                                         |
| Responsibility alignment   |     20 | AI rating (0–100) of how well the experience matches the listed duties, with verified evidence for strong matches                                                        |
| Experience                 |     10 | Meets the minimum → 100; within 1 year → 70; within 2 → 40; further → 10; more than 5 years over the maximum → 80, noted as possibly overqualified                       |
| Education & certifications |     10 | Level met → 100; one level below → 50; lower → 0. Blended 50/50 with required certifications held, when there are any                                                    |
| Title & seniority          |     10 | Word overlap between the posting's title and your closest recent title (with synonyms), blended 50/50 with seniority distance: same 100, one step 70, two 40, further 10 |

**Redistribution.** When the posting doesn't say something (no years, no education, no
title) or AI didn't run (responsibility alignment), that component is _not assessed_. Its
weight is shared proportionally among the components that were, so missing information
never counts against you. The report shows each component's effective weight.

**Bands.** Strong 80–100 · Moderate 60–79 · Partial 40–59 · Low 0–39.

## 4. Honesty rules

- Missing requirements get conditional suggestions: "If you have experience with X, add it
  to Skills and reference it in a relevant bullet." ATSly never says "add X".
- Requirements the resume clearly doesn't meet, such as years of experience or a required
  certification, are listed under "Worth knowing" instead of being glossed over.
- A posting with nothing specific to match gets a note that the score isn't meaningful.
- Without AI, the report says matching used exact names and known related terms only, so
  skills described in other words may have been missed.

## Worked example

A posting for a Senior Backend Engineer asks for Python, Kubernetes and Rust (required),
Terraform and Scala (preferred), 5+ years and a bachelor's degree, and lists no duties.
The resume shows Python and Kubernetes, Terraform, 8 years, a bachelor's degree, and a
Senior Backend Engineer title.

| Component                 |        Score | Effective weight |           Points |
| ------------------------- | -----------: | ---------------: | ---------------: |
| Required skills (2 of 3)  |           67 |             50 % |             33.3 |
| Preferred skills (1 of 2) |           50 |           12.5 % |              6.3 |
| Responsibility alignment  | not assessed |              0 % |                — |
| Experience                |          100 |           12.5 % |             12.5 |
| Education                 |          100 |           12.5 % |             12.5 |
| Title & seniority         |          100 |           12.5 % |             12.5 |
| **Match**                 |              |                  | **77, moderate** |

Responsibility alignment's 20 % is shared among the other five in proportion to their
weights (40 : 10 : 10 : 10 : 10). Rust is listed as missing, with the conditional
suggestion; Scala as a missing preferred skill.
