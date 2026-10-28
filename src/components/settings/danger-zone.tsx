"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientFailure } from "@/lib/client/api-response";
import { deleteAccount, deleteAllData } from "@/lib/client/dashboard";
import { pluralize } from "@/lib/utils/format";

type Action = {
  key: "data" | "account";
  title: string;
  description: string;
  button: string;
  confirmTitle: string;
  confirmBody: string;
};

const ACTIONS: Action[] = [
  {
    key: "data",
    title: "Delete all scans",
    description:
      "Permanently deletes every report, with the resumes and job descriptions behind them. Your account stays.",
    button: "Delete all scans",
    confirmTitle: "Delete all scans?",
    confirmBody:
      "Every report, resume and job description in your account will be permanently deleted. This can't be undone.",
  },
  {
    key: "account",
    title: "Delete account and all data",
    description:
      "Permanently deletes your account and everything in it, and signs you out.",
    button: "Delete account",
    confirmTitle: "Delete your account?",
    confirmBody:
      "Your account and all of its reports, resumes and job descriptions will be permanently deleted. This can't be undone.",
  },
];

function failureMessage(failure: ClientFailure): string {
  if (failure.code === "NETWORK_ERROR")
    return "Connection lost. Check your connection and try again.";
  if (failure.code === "UNAUTHENTICATED")
    return "Your session has ended. Log in again to continue.";
  return "Something went wrong on our side. Nothing was deleted; please try again.";
}

/** Settings → Danger zone — docs/PLANNING.md §7.6: each action asks you to type DELETE. */
export function DangerZone() {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState<Action | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function start(action: Action) {
    setTyped("");
    setError(null);
    setDone(null);
    setOpen(action);
  }

  async function confirm() {
    if (!open || typed !== "DELETE" || pending) return;
    setPending(true);
    setError(null);
    if (open.key === "account") {
      const result = await deleteAccount();
      if (!result.ok) {
        setPending(false);
        return setError(failureMessage(result));
      }
      // The response cleared the session cookie; refreshed pages render signed out.
      router.replace("/");
      router.refresh();
      return;
    }
    const result = await deleteAllData();
    setPending(false);
    if (!result.ok) return setError(failureMessage(result));
    setOpen(null);
    setDone(
      `Deleted ${pluralize(result.data.scans, "report")} and ${pluralize(result.data.resumes, "resume")}.`,
    );
    router.refresh();
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-lg border border-danger/40 bg-background p-6"
    >
      <h2 id={`${id}-title`} className="type-h4">
        Danger zone
      </h2>
      <ul className="mt-4 divide-y divide-border">
        {ACTIONS.map((action) => (
          <li
            key={action.key}
            className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{action.title}</p>
              <p className="mt-1 text-sm leading-6 text-subtle">{action.description}</p>
            </div>
            <Button
              type="button"
              variant="danger-outline"
              className="w-full shrink-0 sm:w-fit"
              onClick={() => start(action)}
            >
              {action.button}
            </Button>
          </li>
        ))}
      </ul>
      <p role="status" className="mt-4 text-sm text-body empty:hidden">
        {done}
      </p>

      <AlertDialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next && !pending) setOpen(null);
        }}
      >
        <AlertDialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{open?.confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{open?.confirmBody}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-confirm`}>Type DELETE to confirm</Label>
              <Input
                id={`${id}-confirm`}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>
            {error ? (
              <p role="alert" className="flex gap-2 text-sm text-danger-strong">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            ) : null}
            <AlertDialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger-outline"
                loading={pending}
                disabled={typed !== "DELETE"}
              >
                {open?.button}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
