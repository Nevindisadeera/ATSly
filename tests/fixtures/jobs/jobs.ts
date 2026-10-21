import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { JobEducationLevel, Seniority } from "@/lib/matching";

/**
 * Job description fixtures with the requirements rules extraction should find —
 * docs/PLANNING.md §26 ("six job descriptions across domains"). Synthetic postings.
 */

export type JobFixture = {
  name: string;
  load: () => string;
  expect: {
    title: string;
    seniority: Seniority;
    years: { min: number | null; max: number | null };
    education: { level: JobEducationLevel; required?: boolean };
    /** Must be extracted as required. */
    required: string[];
    /** Must be extracted as preferred. */
    preferred: string[];
    certifications?: { name: string; importance: "required" | "preferred" }[];
    minResponsibilities?: number;
  };
};

const load = (file: string) => () =>
  readFileSync(join(process.cwd(), "tests/fixtures/jobs", file), "utf8");

export const JOB_FIXTURES: JobFixture[] = [
  {
    name: "backend-engineer",
    load: load("backend-engineer.txt"),
    expect: {
      title: "Senior Backend Engineer",
      seniority: "senior",
      years: { min: 5, max: null },
      // "or equivalent practical experience" makes the degree optional.
      education: { level: "bachelor", required: false },
      required: [
        "Go",
        "Python",
        "PostgreSQL",
        "Redis",
        "AWS",
        "Docker",
        "Kubernetes",
        "Microservices",
        "REST APIs",
      ],
      preferred: ["Kafka", "Terraform", "GraphQL"],
      minResponsibilities: 5,
    },
  },
  {
    name: "data-analyst",
    load: load("data-analyst.txt"),
    expect: {
      title: "Data Analyst",
      seniority: "unspecified",
      years: { min: 2, max: 4 },
      education: { level: "bachelor", required: true },
      required: [
        "SQL",
        "Microsoft Excel",
        "Python",
        "pandas",
        "Statistics",
        "Tableau",
        "Power BI",
      ],
      preferred: ["dbt", "Looker", "Snowflake", "BigQuery"],
      minResponsibilities: 4,
    },
  },
  {
    name: "product-designer",
    load: load("product-designer.txt"),
    expect: {
      title: "Product Designer",
      seniority: "mid",
      years: { min: 3, max: null },
      education: { level: "unspecified" },
      required: [
        "Figma",
        "User Research",
        "Design Systems",
        "Accessibility",
        "UX Design",
        "UI Design",
      ],
      preferred: ["HTML", "CSS", "Framer"],
      minResponsibilities: 4,
    },
  },
  {
    name: "marketing-manager",
    load: load("marketing-manager.txt"),
    expect: {
      title: "Digital Marketing Manager",
      seniority: "manager",
      years: { min: 5, max: 7 },
      education: { level: "bachelor", required: true },
      required: [
        "SEO",
        "SEM",
        "HubSpot",
        "Google Analytics",
        "Email Marketing",
        "Content Marketing",
      ],
      preferred: ["Salesforce", "Copywriting"],
      certifications: [
        { name: "Google Analytics Certification", importance: "preferred" },
      ],
    },
  },
  {
    name: "financial-analyst",
    load: load("financial-analyst.txt"),
    expect: {
      title: "Financial Analyst, FP&A",
      seniority: "unspecified",
      years: { min: 3, max: null },
      // "Boston, MA" is a place, not a master's degree.
      education: { level: "bachelor", required: true },
      required: [
        "FP&A",
        "Financial Modeling",
        "Microsoft Excel",
        "NetSuite",
        "SQL",
        "Variance Analysis",
      ],
      preferred: [],
      certifications: [
        { name: "CPA", importance: "preferred" },
        { name: "CFA", importance: "preferred" },
      ],
      minResponsibilities: 4,
    },
  },
  {
    name: "project-manager",
    load: load("project-manager.txt"),
    expect: {
      title: "IT Project Manager",
      seniority: "manager",
      years: { min: 7, max: null },
      education: { level: "bachelor", required: true },
      required: [
        "Agile",
        "Scrum",
        "Jira",
        "Microsoft Project",
        "Risk Management",
        "Stakeholder Management",
      ],
      preferred: [],
      certifications: [
        { name: "PMP", importance: "required" },
        { name: "Certified ScrumMaster", importance: "preferred" },
        { name: "ITIL", importance: "preferred" },
      ],
      minResponsibilities: 4,
    },
  },
];
