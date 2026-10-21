import {
  hasFirstPerson,
  isQuantified,
  openingVerb,
  percent,
  plural,
  startsWithActionVerb,
  weakPhrasesIn,
  wordsOf,
} from "../text-metrics";
import type { Check, CheckContext } from "../types";
import { englishOnly, notApplicable, pass, problem, sample } from "./helpers";

/** Content quality (weight 15): do the bullets show impact? — §18.4. */

const MIN_BULLETS = 3;
const tooFewBullets = () => notApplicable(`Needs at least ${MIN_BULLETS} bullet points.`);

const bulletEvidence = (items: CheckContext["bullets"]) =>
  sample(items).map((b) => ({ excerpt: b.text, location: b.location }));

export const contentChecks: Check[] = [
  {
    id: "Q01",
    category: "content",
    title: "Bullets start with action verbs",
    rule: "Bullets that open with an action verb: 80% or more → 0, 50–79% → −10, under 50% → −20. English only.",
    maxDeduction: 20,
    severity: "major",
    confidence: "high",
    fix: "Start each bullet with a strong past-tense verb such as Led, Built, Reduced or Launched.",
    strength: "Bullets lead with strong action verbs",
    run({ bullets, resume }) {
      if (bullets.length < MIN_BULLETS) return tooFewBullets();
      const skip = englishOnly(resume);
      if (skip) return skip;
      const weak = bullets.filter((b) => !startsWithActionVerb(b.text));
      const share = percent(bullets.length - weak.length, bullets.length);
      if (share >= 80) return pass(`${share}% of bullets start with an action verb.`);
      return problem(
        share >= 50 ? 10 : 20,
        `Only ${share}% of bullets start with an action verb. Strong verbs make your contribution clear at a glance.`,
        bulletEvidence(weak),
      );
    },
  },
  {
    id: "Q02",
    category: "content",
    title: "Quantified results",
    rule: "Bullets with a number or measurable result: 40% or more → 0, 20–39% → −12, under 20% → −25.",
    maxDeduction: 25,
    severity: "major",
    confidence: "high",
    fix: "Add numbers where you can: percentages, amounts, team sizes, time saved or users reached.",
    strength: "Achievements backed by numbers",
    run({ bullets }) {
      if (bullets.length < MIN_BULLETS) return tooFewBullets();
      const unquantified = bullets.filter((b) => !isQuantified(b.text));
      const share = percent(bullets.length - unquantified.length, bullets.length);
      if (share >= 40)
        return pass(`${share}% of bullets include a number or measurable result.`);
      return problem(
        share >= 20 ? 12 : 25,
        `Only ${share}% of bullets include a number. Measurable results are the strongest evidence of impact.`,
        bulletEvidence(unquantified),
      );
    },
  },
  {
    id: "Q03",
    category: "content",
    title: "Bullet length",
    rule: "More than 30% of bullets under 8 or over 30 words: −10.",
    maxDeduction: 10,
    severity: "minor",
    confidence: "high",
    fix: "Keep bullets between 8 and 30 words: one achievement, its method and its result.",
    run({ bullets }) {
      if (bullets.length < MIN_BULLETS) return tooFewBullets();
      const outside = bullets.filter((b) => {
        const n = wordsOf(b.text).length;
        return n < 8 || n > 30;
      });
      return outside.length / bullets.length <= 0.3
        ? pass("Most bullets are a readable length.")
        : problem(
            10,
            `${percent(outside.length, bullets.length)}% of bullets are shorter than 8 or longer than 30 words.`,
            bulletEvidence(outside),
          );
    },
  },
  {
    id: "Q04",
    category: "content",
    title: "First-person pronouns",
    rule: "First-person pronouns in bullets or the summary: −5. English only.",
    maxDeduction: 5,
    severity: "minor",
    confidence: "high",
    fix: "Drop “I”, “my” and “we”: write “Led a team of five” rather than “I led my team of five”.",
    run({ bullets, resume }) {
      const skip = englishOnly(resume);
      if (skip) return skip;
      const items = [...bullets];
      if (resume.summary?.text)
        items.push({ text: resume.summary.text, location: "Summary" });
      if (items.length === 0) return notApplicable("No bullets or summary to check.");
      const personal = items.filter((b) => hasFirstPerson(b.text));
      return personal.length === 0
        ? pass("No first-person pronouns.")
        : problem(
            5,
            `${plural(personal.length, "line")} ${personal.length === 1 ? "uses" : "use"} first-person pronouns such as “I” or “my”. Resumes conventionally leave them out.`,
            bulletEvidence(personal),
          );
    },
  },
  {
    id: "Q05",
    category: "content",
    title: "Weak phrases",
    rule: "−3 for each weak phrase in bullets or the summary, up to −15. English only.",
    maxDeduction: 15,
    severity: "minor",
    confidence: "high",
    fix: "Replace phrases like “responsible for” or “worked on” with what you actually did and achieved.",
    run({ bullets, resume }) {
      const skip = englishOnly(resume);
      if (skip) return skip;
      const items = [...bullets];
      if (resume.summary?.text)
        items.push({ text: resume.summary.text, location: "Summary" });
      if (items.length === 0) return notApplicable("No bullets or summary to check.");
      const hits = items.flatMap((b) =>
        weakPhrasesIn(b.text).map((phrase) => ({ phrase, ...b })),
      );
      if (hits.length === 0) return pass("No weak phrases such as “responsible for”.");
      return problem(
        Math.min(15, hits.length * 3),
        `${plural(hits.length, "weak phrase")} found. They describe duties rather than achievements.`,
        sample(hits).map((h) => ({
          excerpt: h.text,
          location: `${h.location} · “${h.phrase}”`,
        })),
      );
    },
  },
  {
    id: "Q06",
    category: "content",
    title: "Repeated action verbs",
    rule: "One action verb opens more than 3 bullets: −5. English only.",
    maxDeduction: 5,
    severity: "minor",
    confidence: "high",
    fix: "Vary your verbs: alternatives to “managed” include led, directed, ran and oversaw.",
    run({ bullets, resume }) {
      if (bullets.length < MIN_BULLETS) return tooFewBullets();
      const skip = englishOnly(resume);
      if (skip) return skip;
      const counts = new Map<string, number>();
      for (const b of bullets) {
        if (!startsWithActionVerb(b.text)) continue;
        const verb = openingVerb(b.text)!;
        counts.set(verb, (counts.get(verb) ?? 0) + 1);
      }
      const repeated = [...counts.entries()].filter(([, n]) => n > 3);
      return repeated.length === 0
        ? pass("Action verbs are varied.")
        : problem(
            5,
            `${repeated.map(([verb]) => `“${verb}”`).join(", ")} ${repeated.length === 1 ? "starts" : "start"} more than three bullets.`,
            repeated.map(([excerpt, count]) => ({ excerpt, count })),
          );
    },
  },
  {
    id: "Q07",
    category: "content",
    title: "Overall content quality (AI)",
    rule: "AI content rating: −round((100 − rating) ÷ 100 × 20), at most −20 (3 overall points). Not applicable until AI review runs.",
    maxDeduction: 20,
    severity: "major",
    confidence: "high",
    fix: "See the AI suggestions for specific bullets to strengthen.",
    run({ ai }) {
      if (!ai) return notApplicable("AI content review hasn't run for this scan.");
      // Bounded: at most 20 category points, which is 3 points of the overall score.
      const rating = Math.min(100, Math.max(0, Math.round(ai.contentQuality)));
      const deduction = Math.round(((100 - rating) / 100) * 20);
      return deduction === 0
        ? pass(`AI rated your content ${rating} out of 100.`)
        : problem(deduction, `AI rated your content ${rating} out of 100.`, [
            { count: rating },
          ]);
    },
  },
];
