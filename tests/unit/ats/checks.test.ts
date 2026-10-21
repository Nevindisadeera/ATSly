import { describe, expect, it } from "vitest";

import { CHECKS } from "@/lib/ats";
import { SKILLS } from "@/lib/taxonomy";

import { evaluate, role, setBullets, skill, type Draft } from "../../support/ats";

/** Every check: passes on a clean resume, fails or warns when broken, and is na when it can't apply. */

const fails = (id: string, change: (d: Draft) => void) => evaluate(id, change);
const nonEnglish = (d: Draft) => {
  d.parsed.meta.language = "other";
};
const words = (n: number, word = "word") =>
  Array.from({ length: n }, () => word).join(" ");

describe("the clean resume", () => {
  it.each(CHECKS.map((c) => c.id))("%s passes (Q07 is na without AI)", (id) => {
    const result = evaluate(id);
    expect(result.status, result.explanation).toBe(id === "Q07" ? "na" : "pass");
    expect(result.deduction).toBe(0);
    expect(result.fix).toBeUndefined();
  });
});

describe("Formatting", () => {
  it("F01 deducts fully for DOCX tables and less, at low confidence, for PDF", () => {
    const docx = fails("F01", (d) => (d.layout.tables.count = 2));
    expect(docx).toMatchObject({
      status: "fail",
      deduction: 25,
      confidence: "high",
      evidence: [{ count: 2 }],
    });
    const pdf = fails("F01", (d) => {
      d.format = "pdf";
      d.layout.tables.count = 1;
    });
    expect(pdf).toMatchObject({
      status: "fail",
      severity: "major",
      confidence: "low",
      deduction: 6,
    });
  });

  it("F02 fails for text boxes and is na for PDF", () => {
    expect(fails("F02", (d) => (d.layout.textBoxes = { count: 1 }))).toMatchObject({
      status: "fail",
      deduction: 20,
    });
    expect(fails("F02", (d) => (d.layout.textBoxes = null)).status).toBe("na");
  });

  it("F03 warns for images but not for scanned pages", () => {
    expect(fails("F03", (d) => (d.layout.images.count = 2))).toMatchObject({
      status: "warn",
      deduction: 8,
    });
    const scanned = fails(
      "F03",
      (d) => (d.layout.images = { count: 1, imageOnlyPages: [1] }),
    );
    expect(scanned.status).toBe("pass");
  });

  it("F04 deducts 60 for some image-only pages and 100 when every page is one", () => {
    const some = fails("F04", (d) => {
      d.parsed.stats.pageCount = 2;
      d.layout.images = { count: 1, imageOnlyPages: [2] };
    });
    expect(some).toMatchObject({
      status: "fail",
      deduction: 60,
      evidence: [{ location: "Page 2" }],
    });
    const all = fails(
      "F04",
      (d) => (d.layout.images = { count: 1, imageOnlyPages: [1] }),
    );
    expect(all.deduction).toBe(100);
  });

  it("F05 fails for columns, with the PDF detector's confidence", () => {
    const columns = { detected: true, confidence: "medium" as const, pages: [1] };
    expect(fails("F05", (d) => (d.layout.columns = columns))).toMatchObject({
      deduction: 20,
      confidence: "high",
    });
    const pdf = fails("F05", (d) => {
      d.format = "pdf";
      d.layout.columns = columns;
    });
    expect(pdf).toMatchObject({ status: "fail", deduction: 15, confidence: "medium" });
  });

  it("F06 fails for contact details in a header, and is na on single-page PDFs", () => {
    const header = (d: Draft) => {
      d.parsed.contact.inHeaderOrFooter = true;
      d.layout.headerFooter.text = ["jordan.rivera@example.com | +1 415 555 0134"];
    };
    expect(fails("F06", header)).toMatchObject({ status: "fail", deduction: 15 });
    const pdf = fails("F06", (d) => {
      header(d);
      d.format = "pdf";
    });
    expect(pdf).toMatchObject({ deduction: 11, confidence: "medium" });
    expect(fails("F06", (d) => (d.layout.headerFooter.applicable = false)).status).toBe(
      "na",
    );
  });

  it("F07 fails when more than 1% of characters are unreadable", () => {
    expect(
      fails("F07", (d) => (d.layout.encoding.replacementRatio = 0.05)),
    ).toMatchObject({ status: "fail", deduction: 15 });
    expect(fails("F07", (d) => (d.layout.encoding.replacementRatio = 0.01)).status).toBe(
      "pass",
    );
  });

  it("F08 warns for decorative and symbol-font bullets", () => {
    expect(fails("F08", (d) => (d.layout.bulletGlyphs = ["•", "➤"]))).toMatchObject({
      status: "warn",
      deduction: 5,
      evidence: [{ excerpt: "➤" }],
    });
    expect(fails("F08", (d) => (d.layout.bulletGlyphs = [""])).status).toBe("warn");
  });

  it("F09 warns for links hiding their address, and is na without links", () => {
    const hidden = fails("F09", (d) =>
      d.layout.links.push({ text: "My portfolio", url: "https://jr.dev", hidden: true }),
    );
    expect(hidden).toMatchObject({
      status: "warn",
      deduction: 4,
      evidence: [{ excerpt: "My portfolio" }],
    });
    expect(fails("F09", (d) => (d.layout.links = [])).status).toBe("na");
  });

  it("F10 warns for body text in capitals, ignoring headings, and is na for short text", () => {
    const shouting = fails(
      "F10",
      (d) => (d.text = `${d.text}\n${words(40, "RESPONSIBLE")}`),
    );
    expect(shouting).toMatchObject({ status: "warn", deduction: 6 });
    const headings = fails("F10", (d) => {
      for (const s of d.parsed.sections)
        if (s.heading) s.heading = s.heading.toUpperCase();
      d.text = d.text.replace(/^(Summary|Experience|Skills|Education)$/gm, (h) =>
        h.toUpperCase(),
      );
    });
    expect(headings.status).toBe("pass");
    expect(fails("F10", (d) => (d.text = "Jordan Rivera\nEngineer")).status).toBe("na");
  });

  it("F11 fails for little text per page, and is na when no page has text", () => {
    const sparse = fails("F11", (d) => {
      d.parsed.stats.wordCount = 200;
      d.parsed.stats.pageCount = 2;
    });
    expect(sparse).toMatchObject({
      status: "fail",
      deduction: 8,
      confidence: "medium",
      evidence: [{ count: 100 }],
    });
    expect(
      fails("F11", (d) => (d.layout.images = { count: 1, imageOnlyPages: [1] })).status,
    ).toBe("na");
  });

  it("F12 warns for decorative fonts, and is na without font information", () => {
    const comic = fails("F12", (d) => (d.layout.fonts = ["Calibri", "Comic Sans MS"]));
    expect(comic).toMatchObject({ status: "warn", deduction: 5 });
    expect(comic.explanation).toContain("Comic Sans MS");
    expect(fails("F12", (d) => (d.layout.fonts = [])).status).toBe("na");
  });
});

describe("Structure", () => {
  it("S01 deducts 10 per non-standard heading, up to 30, ignoring 'other' sections", () => {
    const one = fails("S01", (d) => {
      d.parsed.sections[2]!.heading = "My Journey";
      d.parsed.sections[2]!.headingIsStandard = false;
    });
    expect(one).toMatchObject({
      status: "fail",
      deduction: 10,
      evidence: [{ excerpt: "My Journey", location: "Looks like experience" }],
    });
    const many = fails("S01", (d) => {
      for (const s of d.parsed.sections) if (s.heading) s.headingIsStandard = false;
    });
    expect(many.deduction).toBe(30);
    const other = fails("S01", (d) => {
      d.parsed.sections.push({
        kind: "other",
        heading: "Fun Facts",
        headingIsStandard: false,
        startLine: 20,
        endLine: 22,
        confidence: 0.5,
      });
    });
    expect(other.status).toBe("pass");
  });

  it("S02 fails for a long block above the first heading, and is na without word counts", () => {
    expect(fails("S02", (d) => (d.parsed.sections[0]!.wordCount = 80))).toMatchObject({
      status: "fail",
      deduction: 11,
    });
    expect(fails("S02", (d) => delete d.parsed.sections[0]!.wordCount).status).toBe("na");
  });

  it("S03 warns when Education precedes Experience after three years", () => {
    const swap = (d: Draft) => {
      const [contact, summary, experience, skills, education] = d.parsed.sections;
      d.parsed.sections = [contact!, summary!, education!, experience!, skills!];
    };
    expect(fails("S03", swap)).toMatchObject({ status: "warn", deduction: 5 });
    const junior = fails("S03", (d) => {
      swap(d);
      d.parsed.stats.totalExperienceMonths = 24;
    });
    expect(junior.status).toBe("pass");
    expect(
      fails(
        "S03",
        (d) =>
          (d.parsed.sections = d.parsed.sections.filter((s) => s.kind !== "education")),
      ).status,
    ).toBe("na");
  });

  it("S04 fails for roles without dates", () => {
    const undated = fails("S04", (d) => {
      delete d.parsed.experience[1]!.start;
      delete d.parsed.experience[1]!.end;
    });
    expect(undated).toMatchObject({
      status: "fail",
      deduction: 15,
      evidence: [{ location: "Experience › Contoso Retail" }],
    });
    expect(fails("S04", (d) => (d.parsed.experience = [])).status).toBe("na");
  });

  it("S05 fails for roles missing a title or company", () => {
    expect(fails("S05", (d) => delete d.parsed.experience[0]!.company)).toMatchObject({
      status: "fail",
      deduction: 8,
    });
    expect(fails("S05", (d) => (d.parsed.experience = [])).status).toBe("na");
  });

  it("S06 warns for mixed date formats", () => {
    expect(
      fails("S06", (d) => (d.parsed.experience[1]!.dateFormats = ["mm/yyyy"])),
    ).toMatchObject({ status: "warn", deduction: 6 });
    expect(
      fails("S06", (d) => d.parsed.experience.forEach((e) => (e.dateFormats = [])))
        .status,
    ).toBe("na");
  });

  it("S07 warns when roles aren't most recent first", () => {
    expect(fails("S07", (d) => d.parsed.experience.reverse())).toMatchObject({
      status: "warn",
      deduction: 6,
    });
    expect(fails("S07", (d) => (d.parsed.experience = [role()])).status).toBe("na");
  });

  it.each([
    { pages: 4, months: 200, words: 1600, deduction: 20 },
    { pages: 3, months: 60, words: 1200, deduction: 10 },
    { pages: 3, months: 130, words: 1200, deduction: 0 },
    { pages: 1, months: 116, words: 200, deduction: 15 },
  ])(
    "S08 length: $pages pages, $months months, $words words → −$deduction",
    ({ pages, months, words: count, deduction }) => {
      const result = fails("S08", (d) => {
        d.parsed.stats = {
          ...d.parsed.stats,
          pageCount: pages,
          totalExperienceMonths: months,
          wordCount: count,
        };
      });
      expect(result.deduction).toBe(deduction);
      expect(result.status).toBe(deduction ? "fail" : "pass");
    },
  );

  it("S09 warns for plain headings, and is na for older parses without emphasis", () => {
    expect(
      fails("S09", (d) => (d.parsed.sections[3]!.headingEmphasis = false)),
    ).toMatchObject({ status: "warn", deduction: 6, evidence: [{ excerpt: "Skills" }] });
    expect(
      fails("S09", (d) => d.parsed.sections.forEach((s) => delete s.headingEmphasis))
        .status,
    ).toBe("na");
  });

  it("S10 warns for repeated sections", () => {
    const repeated = fails("S10", (d) => {
      d.parsed.sections.push({
        kind: "skills",
        heading: "Technical Skills",
        headingIsStandard: true,
        startLine: 20,
        endLine: 22,
        confidence: 1,
      });
    });
    expect(repeated).toMatchObject({
      status: "warn",
      deduction: 5,
      evidence: [{ location: "skills", count: 2 }],
    });
  });
});

describe("Completeness", () => {
  it("C01 deducts 20 for a missing email and 10 for an invalid one", () => {
    expect(fails("C01", (d) => delete d.parsed.contact.email)).toMatchObject({
      status: "fail",
      deduction: 20,
    });
    expect(
      fails("C01", (d) => (d.parsed.contact.email = "jordan@localhost")),
    ).toMatchObject({ status: "fail", deduction: 10 });
  });

  it.each([
    ["C02", 15, "fail", (d: Draft) => delete d.parsed.contact.phone],
    ["C03", 5, "warn", (d: Draft) => delete d.parsed.contact.location],
    [
      "C04",
      5,
      "warn",
      (d: Draft) =>
        (d.parsed.contact.links = [{ type: "other", url: "https://example.com" }]),
    ],
    ["C05", 8, "fail", (d: Draft) => delete d.parsed.contact.name],
    ["C06", 8, "warn", (d: Draft) => delete d.parsed.summary],
    ["C07", 30, "fail", (d: Draft) => (d.parsed.experience = [])],
    ["C08", 12, "fail", (d: Draft) => (d.parsed.education = [])],
    [
      "C09",
      12,
      "fail",
      (d: Draft) =>
        (d.parsed.sections = d.parsed.sections.filter((s) => s.kind !== "skills")),
    ],
  ] as const)("%s deducts %i when missing", (id, deduction, status, change) => {
    expect(fails(id, change)).toMatchObject({ status, deduction });
  });

  it("C07 passes with projects instead of experience", () => {
    const student = fails("C07", (d) => {
      d.parsed.experience = [];
      d.parsed.projects = [
        {
          name: "Budget app",
          bullets: ["Built a budgeting app"],
          technologies: [],
          rawText: "Budget app",
        },
      ];
    });
    expect(student.status).toBe("pass");
  });

  it("C10 warns for roles with fewer than two bullets", () => {
    const thin = fails(
      "C10",
      (d) => (d.parsed.experience[1]!.bullets = ["Built internal tools"]),
    );
    expect(thin).toMatchObject({
      status: "warn",
      deduction: 8,
      evidence: [{ location: "Experience › Contoso Retail", count: 1 }],
    });
    expect(fails("C10", (d) => (d.parsed.experience = [])).status).toBe("na");
  });

  it("C11 warns when the latest role has no description", () => {
    expect(fails("C11", (d) => (d.parsed.experience[0]!.bullets = []))).toMatchObject({
      status: "warn",
      deduction: 6,
    });
    expect(fails("C11", (d) => (d.parsed.experience = [])).status).toBe("na");
  });
});

describe("Keywords & skills", () => {
  const hardSkills = SKILLS.filter((s) => s.kind !== "soft").map((s) => s.name);
  const softSkills = SKILLS.filter((s) => s.kind === "soft").map((s) => s.name);

  it("K01 fails without a skills section", () => {
    expect(
      fails(
        "K01",
        (d) => (d.parsed.sections = d.parsed.sections.filter((s) => s.kind !== "skills")),
      ),
    ).toMatchObject({ status: "fail", deduction: 25 });
  });

  it.each([
    [7, 8],
    [4, 16],
    [2, 25],
  ])("K02 with %i recognized hard skills deducts %i", (count, deduction) => {
    const result = fails("K02", (d) => {
      d.parsed.skills = hardSkills.slice(0, count).map(skill);
      d.parsed.experience = [
        role({ bullets: ["Organized weekly planning meetings for the team"] }),
      ];
    });
    expect(result).toMatchObject({ status: "fail", deduction, evidence: [{ count }] });
  });

  it("K02 counts skills used in experience, not only the skills list", () => {
    // Seven skills appear in the clean resume's bullets: Python, AWS, Kubernetes, …
    expect(fails("K02", (d) => (d.parsed.skills = []))).toMatchObject({
      deduction: 8,
      evidence: [{ count: 7 }],
    });
  });

  it("K03 grades how many listed skills appear in experience, and needs three", () => {
    const unbacked = (d: Draft) =>
      (d.parsed.experience = [
        role({ bullets: ["Organized weekly planning meetings for the team"] }),
      ]);
    expect(fails("K03", unbacked)).toMatchObject({ status: "fail", deduction: 20 });
    const some = fails("K03", (d) => {
      d.parsed.skills = ["Python", "AWS", "Terraform", "PostgreSQL", "React"].map(skill);
      d.parsed.experience = [
        role({ bullets: ["Built Python services on AWS for the billing team"] }),
      ];
    });
    expect(some).toMatchObject({ deduction: 10 });
    expect(some.explanation).toContain("40%");
    expect(fails("K03", (d) => (d.parsed.skills = [skill("Python")])).status).toBe("na");
  });

  it("K04 warns for an acronym without its full form, and is na for non-English resumes", () => {
    const seo = (d: Draft) =>
      (d.text = `${d.text}\nGrew organic traffic with SEO audits`);
    expect(fails("K04", seo)).toMatchObject({
      status: "warn",
      deduction: 5,
      evidence: [{ excerpt: "SEO" }],
    });
    const both = fails(
      "K04",
      (d) => (d.text = `${d.text}\nSearch engine optimization (SEO) audits`),
    );
    expect(both.status).toBe("pass");
    expect(
      fails("K04", (d) => {
        seo(d);
        nonEnglish(d);
      }).status,
    ).toBe("na");
  });

  it("K05 warns for over 40 skills or a term repeated more than 8 times", () => {
    expect(
      fails("K05", (d) => (d.parsed.skills = hardSkills.slice(0, 41).map(skill))),
    ).toMatchObject({ status: "warn", deduction: 8 });
    const stuffed = fails(
      "K05",
      (d) => (d.text = `${d.text}\n${words(9, "Kubernetes")}`),
    );
    expect(stuffed).toMatchObject({
      status: "warn",
      evidence: [{ excerpt: "Kubernetes" }],
    });
    expect(stuffed.evidence[0]!.count).toBeGreaterThan(8);
  });

  it("K06 warns when soft skills dominate, and needs four recognized skills", () => {
    const soft = fails(
      "K06",
      (d) => (d.parsed.skills = [...softSkills.slice(0, 3), "Python"].map(skill)),
    );
    expect(soft).toMatchObject({ status: "warn", deduction: 10 });
    expect(
      fails("K06", (d) => (d.parsed.skills = ["Python", "AWS"].map(skill))).status,
    ).toBe("na");
  });

  it("K07 warns for buzzword-heavy text, and is na for very short text", () => {
    const buzz = fails(
      "K07",
      (d) =>
        (d.text = `${d.text}\nResults-driven, passionate, motivated, dynamic self-starter and team player`),
    );
    expect(buzz).toMatchObject({ status: "warn", deduction: 7 });
    expect(fails("K07", (d) => (d.text = "Jordan Rivera")).status).toBe("na");
  });
});

describe("Content quality", () => {
  const strong = [
    "Led a team of 6 engineers to rebuild the checkout service",
    "Built a Python data pipeline that processes 2 million events",
  ];
  const weak = [
    "Responsible for the checkout service and its daily operations",
    "Worked on the data pipeline with the analytics team members",
    "Helped with release testing for the mobile app every sprint",
  ];

  it.each([
    [[...strong, ...strong, ...weak.slice(0, 1)], 0],
    [[...strong, ...weak], 20],
    [[...strong, ...strong, ...weak.slice(0, 2)], 10],
  ])("Q01 grades action-verb openings (%#)", (bullets, deduction) => {
    expect(fails("Q01", (d) => setBullets(d, bullets)).deduction).toBe(deduction);
  });

  it("Q01 is na with fewer than three bullets or for non-English resumes", () => {
    expect(fails("Q01", (d) => setBullets(d, strong)).status).toBe("na");
    expect(fails("Q01", nonEnglish).status).toBe("na");
  });

  it.each([
    [
      [
        "Rebuilt the checkout service end to end for the web team",
        "Built a data pipeline for the analytics group using Python",
        "Automated release testing across the mobile apps every sprint",
        "Cut cloud costs by 20% across production clusters",
      ],
      12,
    ],
    [
      [
        "Rebuilt the checkout service end to end for the web team",
        "Built a data pipeline for the analytics group using Python",
        "Automated release testing across the mobile apps every sprint",
      ],
      25,
    ],
  ])("Q02 grades quantified bullets (%#)", (bullets, deduction) => {
    expect(fails("Q02", (d) => setBullets(d, bullets))).toMatchObject({
      status: "fail",
      deduction,
    });
  });

  it("Q03 warns when many bullets are too short or too long", () => {
    const result = fails("Q03", (d) =>
      setBullets(d, ["Led team", "Built pipeline", ...strong]),
    );
    expect(result).toMatchObject({ status: "warn", deduction: 10 });
  });

  it("Q04 warns for first-person pronouns, but not for a lowercase 'i' inside words", () => {
    const result = fails("Q04", (d) =>
      setBullets(d, ["I led my team of 6 engineers to rebuild checkout", ...strong]),
    );
    expect(result).toMatchObject({
      status: "warn",
      deduction: 5,
      evidence: [{ location: "Experience › Northwind Payments › bullet 1" }],
    });
    expect(
      fails("Q04", (d) =>
        setBullets(d, ["Led an iOS migration for 3 apps in 2 quarters", ...strong]),
      ).status,
    ).toBe("pass");
    expect(fails("Q04", nonEnglish).status).toBe("na");
  });

  it("Q05 deducts 3 per weak phrase, up to 15", () => {
    expect(
      fails("Q05", (d) => setBullets(d, [...weak.slice(0, 2), ...strong])),
    ).toMatchObject({ status: "warn", deduction: 6 });
    expect(fails("Q05", (d) => setBullets(d, [...weak, ...weak]))).toMatchObject({
      deduction: 15,
    });
  });

  it("Q06 warns when one verb opens more than three bullets", () => {
    const led = Array.from(
      { length: 4 },
      (_, i) => `Led project ${i + 1} to launch with 3 partner teams`,
    );
    expect(fails("Q06", (d) => setBullets(d, led))).toMatchObject({
      status: "warn",
      deduction: 5,
      evidence: [{ excerpt: "led", count: 4 }],
    });
  });

  it("Q07 is bounded by the AI rating and na without one", () => {
    expect(fails("Q07", (d) => (d.ai = { contentQuality: 75 }))).toMatchObject({
      status: "fail",
      deduction: 5,
    });
    expect(fails("Q07", (d) => (d.ai = { contentQuality: 0 }))).toMatchObject({
      deduction: 20,
    });
    expect(fails("Q07", (d) => (d.ai = { contentQuality: 150 })).status).toBe("pass");
    expect(evaluate("Q07").status).toBe("na");
  });
});

describe("Readability", () => {
  it("R01 deducts 15 for long bullets and 8 for very short ones", () => {
    expect(
      fails("R01", (d) =>
        setBullets(
          d,
          Array.from({ length: 3 }, () => words(34)),
        ),
      ),
    ).toMatchObject({ status: "warn", deduction: 15 });
    expect(
      fails("R01", (d) => setBullets(d, ["Led team", "Built pipeline", "Cut costs"])),
    ).toMatchObject({ deduction: 8 });
    expect(fails("R01", (d) => setBullets(d, ["Led team"])).status).toBe("na");
  });

  it("R02 fails for paragraph blocks in experience", () => {
    const paragraph = fails("R02", (d) => setBullets(d, [words(55)]));
    expect(paragraph).toMatchObject({
      status: "fail",
      deduction: 25,
      evidence: [{ location: "Experience › Northwind Payments" }],
    });
    expect(paragraph.evidence[0]!.excerpt!.endsWith("…")).toBe(true);
    expect(fails("R02", (d) => (d.parsed.experience = [])).status).toBe("na");
  });

  it("R03 warns above 650 words per page", () => {
    expect(fails("R03", (d) => (d.parsed.stats.wordsPerPage = 700))).toMatchObject({
      status: "warn",
      deduction: 15,
    });
  });

  it("R04 warns for passive bullets", () => {
    const passive = [
      "Costs were reduced by 20% across all regions",
      "The pipeline was built using Python and AWS",
      "Led a team of 6 engineers",
    ];
    expect(fails("R04", (d) => setBullets(d, passive))).toMatchObject({
      status: "warn",
      deduction: 8,
    });
  });

  it("R05 warns for a high reading grade, and is na without enough sentences", () => {
    const dense = Array.from(
      { length: 3 },
      () =>
        "Orchestrated comprehensive organizational transformation initiatives encompassing multidisciplinary interdepartmental collaboration methodologies",
    );
    expect(fails("R05", (d) => setBullets(d, dense))).toMatchObject({
      status: "warn",
      deduction: 8,
    });
    expect(
      fails("R05", (d) => {
        setBullets(d, []);
        delete d.parsed.summary;
      }).status,
    ).toBe("na");
  });

  it("R06 warns for mixed full stops", () => {
    const mixed = [
      "Led a team of 6 engineers.",
      "Built a pipeline for 2 million events.",
      "Cut costs by 20%",
      "Shipped 3 apps",
    ];
    expect(fails("R06", (d) => setBullets(d, mixed))).toMatchObject({
      status: "warn",
      deduction: 5,
      evidence: [{ count: 2 }],
    });
  });

  it("R07 warns for mixed capitalization", () => {
    const mixed = [
      "led a team of 6 engineers",
      "built a pipeline for 2 million events",
      "Cut costs by 20%",
      "Shipped 3 apps",
    ];
    expect(fails("R07", (d) => setBullets(d, mixed))).toMatchObject({
      status: "warn",
      deduction: 5,
    });
  });

  it("R08 warns for long summary sentences, and is na without a summary", () => {
    expect(
      fails("R08", (d) => (d.parsed.summary = { text: `${words(36)}.` })),
    ).toMatchObject({ status: "warn", deduction: 7 });
    expect(fails("R08", (d) => delete d.parsed.summary).status).toBe("na");
  });
});
