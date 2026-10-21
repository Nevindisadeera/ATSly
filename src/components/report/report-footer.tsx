import Link from "next/link";

/** Disclaimer and versions — docs/PLANNING.md §7.3, section 10, and Appendix B. */
export function ReportFooter({ engineVersion }: { engineVersion: string }) {
  return (
    <footer className="border-t border-border pt-6 text-sm leading-6 text-subtle">
      <p>
        Estimated compatibility based on common ATS parsing practices, not any specific
        vendor.
      </p>
      <p className="mt-2">
        Engine v{engineVersion} ·{" "}
        <Link
          href="/methodology"
          className="rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          How scoring works
        </Link>
      </p>
    </footer>
  );
}
