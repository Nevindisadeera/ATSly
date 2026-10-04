import type { Metadata } from "next";
import { ArrowRight, FileText, MoreHorizontal, Upload } from "lucide-react";

import {
  BandChip,
  EmptyState,
  EvidenceBlock,
  KeywordChip,
  MetricCard,
  ScoreBar,
  ScoreRing,
  SectionHeading,
  SeverityDot,
} from "@/components/data-display";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AtsBand, MatchBand, Severity } from "@/types/report";

// Development-only reference for the design system. This file uses the `.dev.tsx`
// extension, which next.config.ts registers only under `next dev`.

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const SWATCHES = [
  {
    group: "Surfaces",
    items: [
      ["background", "#FFFFFF"],
      ["soft", "#F8FAFC"],
      ["track", "#F1F5F9"],
    ],
  },
  {
    group: "Text",
    items: [
      ["foreground", "#0F172A"],
      ["body", "#334155"],
      ["subtle", "#475569"],
      ["muted-foreground", "#64748B"],
    ],
  },
  {
    group: "Brand",
    items: [
      ["primary", "#2563EB"],
      ["primary-hover", "#1D4ED8"],
      ["primary-soft", "#EFF6FF"],
      ["navy", "#0F172A"],
    ],
  },
  {
    group: "Lines",
    items: [
      ["border", "#E2E8F0"],
      ["border-strong", "#CBD5E1"],
      ["input", "#8592A6"],
    ],
  },
  {
    group: "Status",
    items: [
      ["success", "#16A34A"],
      ["success-strong", "#15803D"],
      ["success-soft", "#F0FDF4"],
      ["warning", "#F59E0B"],
      ["warning-strong", "#B45309"],
      ["warning-soft", "#FFFBEB"],
      ["danger", "#DC2626"],
      ["danger-strong", "#B91C1C"],
      ["danger-soft", "#FEF2F2"],
    ],
  },
] as const;

const TYPE_SCALE = [
  ["type-display", "Make your resume ATS-ready."],
  ["type-h1", "Your ATS report"],
  ["type-h2", "Score breakdown"],
  ["type-h3", "Keyword coverage"],
  ["type-h4", "Experience entries missing dates"],
  [
    "type-lead",
    "Analyze your resume, uncover missing keywords, and understand how well it matches your target role.",
  ],
  [
    "type-body",
    "Each deduction names the check, the evidence, and the points. Low-confidence detections are labelled Likely and deduct less.",
  ],
  ["type-small", "Scanned 4 Oct 2026 · 2 pages · 540 words"],
  ["type-caption", "ATS resume analysis"],
] as const;

const CATEGORIES = [
  { label: "Formatting", weight: 25, value: 87 },
  { label: "Structure", weight: 20, value: 69 },
  { label: "Completeness", weight: 15, value: 87 },
  { label: "Keywords & skills", weight: 15, value: 74 },
  { label: "Content quality", weight: 15, value: 61 },
  { label: "Readability", weight: 10, value: 55 },
];

const ATS_BANDS: { band: AtsBand; value: number }[] = [
  { band: "excellent", value: 91 },
  { band: "good", value: 78 },
  { band: "fair", value: 58 },
  { band: "needs_work", value: 34 },
];
const MATCH_BANDS: MatchBand[] = ["strong", "moderate", "partial", "low"];
const SEVERITIES: Severity[] = ["critical", "major", "minor", "info"];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-t border-border py-12 first:border-t-0"
    >
      <SectionHeading id={id} title={title} description={description} size="h3" />
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="size-10 shrink-0 rounded-md border border-border"
        style={{ backgroundColor: `var(--${name})` }}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="font-mono text-xs text-muted-foreground">{hex}</p>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-[1120px] px-4 py-16 md:px-8">
      <SectionHeading
        as="h1"
        size="h1"
        eyebrow="Development only"
        title="ATSly design system"
        description="Tokens, primitives and data-display components from docs/PLANNING.md §8–§11. This page is not part of production builds."
      />

      <Section
        id="colors"
        title="Color"
        description="Blue is reserved for the primary action, links and focus. Status colors carry meaning only."
      >
        <div className="grid gap-10">
          {SWATCHES.map((group) => (
            <div key={group.group}>
              <h3 className="type-caption text-muted-foreground">{group.group}</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {group.items.map(([name, hex]) => (
                  <Swatch key={name} name={name} hex={hex} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="type"
        title="Typography"
        description="Geist Sans. Weights 400, 500, 600; 300 for large score numerals only."
      >
        <div className="grid gap-6">
          {TYPE_SCALE.map(([cls, sample]) => (
            <div
              key={cls}
              className="grid gap-1 md:grid-cols-[160px_1fr] md:items-baseline md:gap-8"
            >
              <p className="font-mono text-xs text-muted-foreground">{cls}</p>
              <p className={`${cls} text-foreground`}>{sample}</p>
            </div>
          ))}
          <div className="grid gap-1 md:grid-cols-[160px_1fr] md:items-baseline md:gap-8">
            <p className="font-mono text-xs text-muted-foreground">type-score-xl / md</p>
            <p className="flex items-baseline gap-8 text-foreground">
              <span className="type-score-xl">82</span>
              <span className="type-score-md">78</span>
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="buttons"
        title="Buttons"
        description="One filled primary per view. Secondary is a navy outline."
      >
        <div className="grid gap-8">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Scan my resume</Button>
            <Button variant="secondary">See how it works</Button>
            <Button variant="outline">Replace file</Button>
            <Button variant="ghost">Skip for now</Button>
            <Button variant="danger-outline">Delete scan</Button>
            <Button variant="link">Read the methodology</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg" leadingIcon={<Upload aria-hidden="true" />}>
              Large with icon
            </Button>
            <Button size="icon" variant="outline" aria-label="More actions">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button loading>Starting analysis…</Button>
            <Button
              variant="secondary"
              loading
              leadingIcon={<ArrowRight aria-hidden="true" />}
            >
              Saving
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </Section>

      <Section
        id="forms"
        title="Form fields"
        description="Input borders use a darker slate to meet the 3:1 non-text contrast minimum."
      >
        <div className="grid max-w-xl gap-6">
          <div className="grid gap-2">
            <Label htmlFor="ds-email">Email</Label>
            <Input
              id="ds-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ds-password">Password</Label>
            <Input
              id="ds-password"
              type="password"
              aria-invalid="true"
              aria-describedby="ds-password-error"
              defaultValue="short"
            />
            <p id="ds-password-error" className="text-sm text-danger-strong">
              Use at least 8 characters.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ds-jd">Job description</Label>
            <Textarea id="ds-jd" placeholder="Paste the job posting here…" />
            <p className="text-sm text-muted-foreground">
              Optional. Paste the full posting for the most accurate match.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ds-disabled">Disabled</Label>
            <Input id="ds-disabled" disabled defaultValue="Read-only value" />
          </div>
        </div>
      </Section>

      <Section
        id="scores"
        title="Scores"
        description="Band color appears on the ring stroke and the band chip only."
      >
        <div className="grid gap-12">
          <div className="flex flex-wrap items-center gap-10">
            <ScoreRing value={82} band="good" label="ATS score" size={168} />
            <ScoreRing
              value={74}
              band="moderate"
              label="Job match"
              size={168}
              caption="Job match"
            />
            <ScoreRing value={84} band="good" label="ATS score" size={128} />
            <ScoreRing value={78} band="moderate" label="Job match" size={96} />
          </div>
          <div className="flex flex-wrap items-center gap-8">
            {ATS_BANDS.map(({ band, value }) => (
              <div key={band} className="flex flex-col items-center gap-3">
                <ScoreRing value={value} band={band} label="ATS score" size={96} />
                <BandChip band={band} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {MATCH_BANDS.map((band) => (
              <BandChip key={band} band={band} />
            ))}
            <BandChip band="excellent">ATS-ready</BandChip>
          </div>
          <div className="grid max-w-xl gap-5">
            {CATEGORIES.map((c) => (
              <ScoreBar key={c.label} label={c.label} value={c.value} weight={c.weight} />
            ))}
          </div>
          <div className="grid max-w-sm gap-3">
            <ScoreBar label="Required skills" value={86} tone="positive" compact />
            <ScoreBar label="Experience fit" value={62} tone="caution" compact />
            <ScoreBar label="Title alignment" value={30} tone="negative" compact />
          </div>
        </div>
      </Section>

      <Section id="metrics" title="Metric cards">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Scans" value={12} hint="Across 3 resumes" />
          <MetricCard
            label="Best ATS score"
            value={88}
            trend={{ direction: "up", text: "+6 since last scan" }}
          />
          <MetricCard
            label="Average match"
            value={71}
            trend={{ direction: "flat", text: "No change" }}
          />
          <MetricCard label="Latest match" loading />
        </div>
      </Section>

      <Section id="issues" title="Severity, keywords and evidence">
        <div className="grid gap-10">
          <div className="flex flex-wrap gap-6">
            {SEVERITIES.map((s) => (
              <SeverityDot key={s} severity={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <KeywordChip
              term="TypeScript"
              state="matched"
              importance="required"
              tooltip="Exact match · Experience › Acme Corp › bullet 2"
            />
            <KeywordChip term="React" state="matched" importance="required" />
            <KeywordChip term="GraphQL" state="missing" importance="required" />
            <KeywordChip term="Kubernetes" state="missing" importance="preferred" />
            <KeywordChip
              term="PostgreSQL"
              state="backed"
              tooltip="Also used in 2 experience bullets"
            />
            <KeywordChip
              term="Figma"
              state="listed"
              tooltip="Listed in Skills but not mentioned in experience"
            />
          </div>
          <div className="grid max-w-2xl gap-4">
            <EvidenceBlock
              text="Built a React and TypeScript dashboard used by 40 account managers, cutting report preparation from 2 hours to 15 minutes."
              location="Experience › Acme Corp › bullet 2"
            />
            <EvidenceBlock text="Worked on frontend development." />
          </div>
        </div>
      </Section>

      <Section id="containers" title="Cards, badges and empty states">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Latest analysis</CardTitle>
              <CardDescription>resume-2026.pdf · Scanned 4 Oct 2026</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <ScoreRing value={84} band="good" label="ATS score" size={96} />
              <p className="text-sm text-body">
                Strong structure. Content quality needs the most attention.
              </p>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="ghost" size="sm">
                Scan against another job
              </Button>
              <Button variant="secondary" size="sm">
                View report
              </Button>
            </CardFooter>
          </Card>
          <EmptyState
            icon={<FileText />}
            title="No scans yet."
            description="Upload a resume to get your first ATS report."
            action={<Button>Scan a resume</Button>}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Primary</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </div>
      </Section>

      <Section id="disclosure" title="Tabs and accordion">
        <div className="grid gap-10 lg:grid-cols-2">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="high">High</TabsTrigger>
              <TabsTrigger value="medium">Medium</TabsTrigger>
              <TabsTrigger value="low">Low</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="pt-4 text-sm text-body">
              8 recommendations
            </TabsContent>
            <TabsContent value="high" className="pt-4 text-sm text-body">
              3 high-priority recommendations
            </TabsContent>
            <TabsContent value="medium" className="pt-4 text-sm text-body">
              3 medium-priority recommendations
            </TabsContent>
            <TabsContent value="low" className="pt-4 text-sm text-body">
              2 low-priority recommendations
            </TabsContent>
          </Tabs>
          <Accordion type="single" collapsible defaultValue="s04">
            <AccordionItem value="s04">
              <AccordionTrigger>
                <span className="flex items-center gap-3">
                  <SeverityDot severity="major">
                    Experience entries missing dates
                  </SeverityDot>
                  <span className="text-sm text-muted-foreground tabular-nums">−15</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-body">
                  Two roles have no dates. Many ATS systems calculate experience from date
                  ranges.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="f08">
              <AccordionTrigger>
                <span className="flex items-center gap-3">
                  <SeverityDot severity="minor">Non-standard bullet symbols</SeverityDot>
                  <span className="text-sm text-muted-foreground tabular-nums">−5</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-body">Use plain round bullets or hyphens.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </Section>

      <Section
        id="overlays"
        title="Overlays"
        description="Dialogs, sheet, menu and tooltip are built on Radix: focus trap, Escape to close, arrow keys in menus."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">How we score</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>How we score</DialogTitle>
                <DialogDescription>
                  Six categories, each starting at 100. Every failing check deducts
                  points.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="danger-outline">Delete scan</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this scan?</AlertDialogTitle>
                <AlertDialogDescription>
                  The report and its recommendations will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Report sections</SheetTitle>
                <SheetDescription>Jump to a section of your report.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Report actions">
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>Scan against another job</DropdownMenuItem>
              <DropdownMenuItem>New scan</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="link">What is “backed”?</Button>
            </TooltipTrigger>
            <TooltipContent>
              The skill also appears in an experience bullet.
            </TooltipContent>
          </Tooltip>
        </div>
      </Section>

      <Section id="data" title="Table, progress and loading">
        <div className="grid gap-10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CATEGORIES.map((c) => (
                <TableRow key={c.label}>
                  <TableCell className="font-medium text-foreground">{c.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.weight}%</TableCell>
                  <TableCell className="text-right tabular-nums">{c.value}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {((c.value * c.weight) / 100).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Overall</TableCell>
                <TableCell className="text-right tabular-nums">74</TableCell>
              </TableRow>
            </TableFooter>
          </Table>

          <div className="grid max-w-md gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground">Uploading resume.pdf</span>
              <span className="text-muted-foreground tabular-nums">42%</span>
            </div>
            <Progress value={42} aria-label="Upload progress" />
          </div>

          <div className="grid max-w-md gap-3" aria-hidden="true">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          <ScrollArea className="h-32 max-w-md rounded-md border border-border">
            <div className="p-4 text-sm text-body">
              {Array.from({ length: 12 }, (_, i) => (
                <p key={i} className="py-1">
                  Recognized skill {i + 1}
                </p>
              ))}
            </div>
          </ScrollArea>

          <Separator />
        </div>
      </Section>
    </main>
  );
}
