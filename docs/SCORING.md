# How ATSly scores resumes

<!-- Generated from src/lib/ats/checks by `npm run docs:scoring`. Do not edit by hand. -->

Engine version **1.1.0** · 55 checks.

## The model

- The overall ATS score is the weighted average of six category scores.
- Each category starts at 100. Every check that finds a problem deducts points; a category never goes below 0.
- A deduction is scaled by how sure the check is: high confidence × 1, medium × 0.75, low × 0.5, rounded to whole points.
- Checks that can't be evaluated are reported as not applicable, with the reason, and deduct nothing.
- Content and readability checks need at least 3 bullet points. Checks built on English word lists don't apply to resumes in other languages.
- Critical and major problems are reported as failures; minor and informational ones as warnings. Both deduct.
- The engine is deterministic: the same resume always gets the same score. AI can change the overall score by at most 3 points (check Q07).

Overall = round(Σ category score × weight ÷ 100).

## Categories

| Category | Weight |
| --- | --- |
| Formatting | 25% |
| Structure | 20% |
| Completeness | 15% |
| Keywords & skills | 15% |
| Content quality | 15% |
| Readability | 10% |

## Bands

| Band | Score | Meaning |
| --- | --- | --- |
| Excellent | 85–100 | ATS-ready |
| Good | 70–84 | Minor improvements |
| Fair | 50–69 | Needs attention |
| Needs work | 0–49 | At risk |

## Checks

### Formatting (weight 25)

| ID | Check | When it deducts | Max | Severity | Confidence | How to fix |
| --- | --- | --- | --- | --- | --- | --- |
| F01 | Tables | Tables detected: −25 in a DOCX. In a PDF, −12 as a major issue at low confidence, because detection is a layout heuristic. | 25 | critical | high | Replace tables with plain lines of text. For skills, use a simple comma-separated list. |
| F02 | Text boxes | Any Word text box or shape containing text: −20. Not applicable to PDFs. | 20 | critical | high | Move text out of text boxes and shapes into normal paragraphs. |
| F03 | Images or photo | Any image other than a scanned page: −8. | 8 | minor | high | Remove photos, logos and icons. ATS systems ignore them, and many employers prefer resumes without a photo. |
| F04 | Scanned or image-only pages | Some pages are image-only: −60. Every page is: −100, so Formatting scores 0. | 100 | critical | high | Export your resume directly from your editor as a text PDF or DOCX instead of scanning or saving it as an image. |
| F05 | Multi-column layout | Columns detected: −20 (high confidence in a DOCX; a PDF uses the detector's confidence). | 20 | major | high | Use a single-column layout. Put contact details at the top and sections one after another. |
| F06 | Contact details in header or footer | Email or phone found only in a page header or footer: −15. Not applicable to single-page PDFs. | 15 | major | high | Move your email and phone number into the main body at the top of the page. |
| F07 | Unreadable characters | More than 1% of characters unreadable: −15. | 15 | major | high | Re-export the PDF with standard fonts embedded, or upload the DOCX instead. |
| F08 | Decorative bullet symbols | Decorative or symbol-font bullet glyphs (such as ➤ ★ ✔): −5. | 5 | minor | high | Use plain round bullets (•) or hyphens. |
| F09 | Links that hide their address | A link whose visible text isn't its address: −4. Not applicable without links. | 4 | info | high | Write the address itself, such as linkedin.com/in/yourname, rather than linking words like “My profile”. |
| F10 | Too much text in capitals | More than 15% of body words (5+ letters, headings excluded) in capitals: −6. Needs 50 words. | 6 | minor | high | Keep capitals for headings and acronyms; write body text in sentence case. |
| F11 | Little text per page | Fewer than 150 words per page on pages with text: −10. | 10 | major | medium | Make sure your text is real text, not part of an image, and that pages aren't mostly empty. |
| F12 | Decorative fonts | A decorative or symbol font in use: −5. Not applicable without font information. | 5 | minor | high | Use a standard font such as Arial, Calibri, Helvetica or Georgia. |

### Structure (weight 20)

| ID | Check | When it deducts | Max | Severity | Confidence | How to fix |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | Non-standard section headings | −10 for each recognized section with a non-standard heading, up to −30. | 30 | major | high | Use standard headings such as Experience, Education, Skills and Summary. |
| S02 | Content without a heading | More than 60 words above the first heading: −15. | 30 | major | medium | Add a heading above every block of content, such as Summary for an opening paragraph. |
| S03 | Section order | Education before Experience with more than 3 years of experience: −5. | 5 | minor | high | With several years of experience, put Experience before Education. |
| S04 | Roles without dates | Any role without dates: −15. | 15 | major | high | Add start and end dates to every role, for example “Jan 2021 – Present”. |
| S05 | Roles missing a title or company | Any role without a clear title or company: −10. | 10 | major | medium | Give every role a job title and a company name on its own line or separated by a comma. |
| S06 | Mixed date formats | Dates written in more than one format: −6. | 6 | minor | high | Write every date the same way, for example “Mar 2021”. |
| S07 | Roles not in reverse-chronological order | Dated roles not listed most recent first: −6. Needs two dated roles. | 6 | minor | high | List your most recent role first. |
| S08 | Resume length | More than 3 pages: −20. More than 2 pages with under 10 years of experience: −10. Under 250 words: −15. | 20 | major | high | Keep it to one or two pages (three only with over ten years of experience), with at least 250 words so ATS systems have enough to match. |
| S09 | Headings that don't stand out | Any heading that looks like body text: −8. | 8 | minor | medium | Make headings bold, larger or in capitals so both ATS parsers and readers can find sections. |
| S10 | Repeated sections | The same kind of section appears more than once: −6. | 6 | minor | medium | Combine sections of the same kind under one heading. |

### Completeness (weight 15)

| ID | Check | When it deducts | Max | Severity | Confidence | How to fix |
| --- | --- | --- | --- | --- | --- | --- |
| C01 | Email address | No email: −20. An email that isn't valid: −10. | 20 | critical | high | Add a professional email address near the top of your resume. |
| C02 | Phone number | No phone number: −15. | 15 | major | high | Add a phone number with your country code, for example +44 7700 900123. |
| C03 | Location | No location: −5. | 5 | minor | high | Add your city and country, such as “Berlin, Germany”. A full street address isn't needed. |
| C04 | LinkedIn or portfolio link | No LinkedIn, GitHub or portfolio link: −5. | 5 | info | high | Add your LinkedIn profile or a portfolio link to your contact details. |
| C05 | Name | No name detected at the top: −10. | 10 | major | medium | Put your full name on the first line, on its own. |
| C06 | Summary | No summary or profile: −8. | 8 | minor | high | Add a two- to three-sentence summary of who you are and what you're looking for. |
| C07 | Experience or projects | No experience and no projects: −30. | 30 | critical | high | Add an Experience section. If you're starting out, add a Projects section with what you built. |
| C08 | Education | No education: −12. | 12 | major | high | Add an Education section with your highest qualification. |
| C09 | Skills section | No skills section: −12. | 12 | major | high | Add a Skills section listing your main tools and technologies. |
| C10 | Roles with little detail | Any role with fewer than 2 bullets: −8. | 8 | minor | high | Give each role at least two bullet points describing what you achieved. |
| C11 | Most recent role has no description | The most recent role has no description: −6. | 6 | minor | high | Describe your most recent role. It's the one recruiters read first. |

### Keywords & skills (weight 15)

| ID | Check | When it deducts | Max | Severity | Confidence | How to fix |
| --- | --- | --- | --- | --- | --- | --- |
| K01 | Dedicated skills section | No skills section: −25. | 25 | major | high | Add a section headed “Skills” that lists your tools, technologies and methods. |
| K02 | Recognized hard skills | Recognized hard skills across the resume: 10 or more → 0, 6–9 → −8, 3–5 → −16, fewer than 3 → −25. | 25 | major | high | List the specific tools, technologies and methods you use, by their standard names. |
| K03 | Skills backed by experience | Listed hard skills that also appear in experience or projects: 60% or more → 0, 30–59% → −10, under 30% → −20. Needs 3 listed skills. | 20 | major | high | Mention your key skills in your experience or projects too, showing where you used them. |
| K04 | Acronyms and their full forms | A common acronym without its full form, or the reverse: −5. English only. | 5 | info | high | Write both forms once, such as “Search engine optimization (SEO)”, so searches for either one match. |
| K05 | Keyword stuffing | More than 40 skills listed, or one skill repeated more than 8 times: −8. | 8 | minor | high | Keep your skills list to what you'd discuss in an interview, and mention each skill naturally. |
| K06 | Mostly soft skills | More than half of the recognized listed skills are soft skills: −10. Needs 4 recognized skills. | 10 | minor | high | List concrete tools and methods in your skills section, and show soft skills through your achievements. |
| K07 | Buzzwords | Buzzwords above 2% of all words: −7. English only. | 7 | minor | high | Replace clichés like “results-driven” with specific achievements that show the quality. |

### Content quality (weight 15)

| ID | Check | When it deducts | Max | Severity | Confidence | How to fix |
| --- | --- | --- | --- | --- | --- | --- |
| Q01 | Bullets start with action verbs | Bullets that open with an action verb: 80% or more → 0, 50–79% → −10, under 50% → −20. English only. | 20 | major | high | Start each bullet with a strong past-tense verb such as Led, Built, Reduced or Launched. |
| Q02 | Quantified results | Bullets with a number or measurable result: 40% or more → 0, 20–39% → −12, under 20% → −25. | 25 | major | high | Add numbers where you can: percentages, amounts, team sizes, time saved or users reached. |
| Q03 | Bullet length | More than 30% of bullets under 8 or over 30 words: −10. | 10 | minor | high | Keep bullets between 8 and 30 words: one achievement, its method and its result. |
| Q04 | First-person pronouns | First-person pronouns in bullets or the summary: −5. English only. | 5 | minor | high | Drop “I”, “my” and “we”: write “Led a team of five” rather than “I led my team of five”. |
| Q05 | Weak phrases | −3 for each weak phrase in bullets or the summary, up to −15. English only. | 15 | minor | high | Replace phrases like “responsible for” or “worked on” with what you actually did and achieved. |
| Q06 | Repeated action verbs | One action verb opens more than 3 bullets: −5. English only. | 5 | minor | high | Vary your verbs: alternatives to “managed” include led, directed, ran and oversaw. |
| Q07 | Overall content quality (AI) | AI content rating: −round((100 − rating) ÷ 100 × 20), at most −20 (3 overall points). Not applicable until AI review runs. | 20 | major | high | See the AI suggestions for specific bullets to strengthen. |

### Readability (weight 10)

| ID | Check | When it deducts | Max | Severity | Confidence | How to fix |
| --- | --- | --- | --- | --- | --- | --- |
| R01 | Average bullet length | Average bullet over 32 words: −15. Under 7 words: −8. | 15 | minor | high | Aim for bullets of about 12 to 25 words. Split long ones and add detail to very short ones. |
| R02 | Paragraph blocks in experience | Any experience item over 50 words: −25. | 25 | major | high | Break long paragraphs into bullet points, one achievement each. |
| R03 | Text density | More than 650 words per page: −15. | 15 | minor | high | Cut less relevant detail or older roles so each page has room to breathe. |
| R04 | Passive voice | Passive voice in more than 20% of bullets: −10. English only. | 10 | minor | medium | Write in the active voice: “Reduced costs by 20%” rather than “Costs were reduced by 20%”. |
| R05 | Reading level | Flesch–Kincaid grade above 14 on bullets and summary: −10. English only. | 10 | info | medium | Use shorter sentences and plainer words where you can. |
| R06 | Bullet punctuation | Between 20% and 80% of bullets end with a full stop: −5. | 5 | info | high | End either all bullets or none of them with a full stop. |
| R07 | Bullet capitalization | Between 20% and 80% of bullets start in lowercase: −5. | 5 | info | high | Start every bullet with a capital letter. |
| R08 | Long summary sentences | Any summary sentence over 35 words: −7. | 7 | minor | high | Keep summary sentences under 25 words. |

## Headline

The one-line headline names the strongest category (when it scores 70 or more) and the weakest one. It's chosen by rule, without AI.
