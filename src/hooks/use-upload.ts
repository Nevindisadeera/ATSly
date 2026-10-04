"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import { uploadResume, type UploadFailureCode } from "@/lib/client/upload-resume";
import { checkResumeFile } from "@/lib/validation/upload";
import type { ResumeUploadResult } from "@/types/api";

export type SelectedFile = { name: string; size: number };

/** Upload failures plus client-only conditions that never reach the network. */
export type UploadErrorCode = UploadFailureCode | "MULTIPLE_FILES";

/**
 * Upload state machine:
 * idle → uploading(progress) → processing → ready
 *   any active state → error | idle (cancel / reset)
 * Client-side validation failures go straight from idle to error with no request.
 */
export type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; file: SelectedFile; progress: number }
  | { phase: "processing"; file: SelectedFile }
  | { phase: "ready"; file: SelectedFile; result: ResumeUploadResult }
  | {
      phase: "error";
      file: SelectedFile | null;
      code: UploadErrorCode;
      source: "client" | "server";
    };

export type UploadAction =
  | { type: "start"; file: SelectedFile }
  | { type: "progress"; percent: number }
  | { type: "uploaded" }
  | { type: "success"; result: ResumeUploadResult }
  | {
      type: "fail";
      file: SelectedFile | null;
      code: UploadErrorCode;
      source: "client" | "server";
    }
  | { type: "reset" };

export const initialUploadState: UploadState = { phase: "idle" };

export function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case "start":
      return { phase: "uploading", file: action.file, progress: 0 };
    case "progress":
      // Progress only moves forward, and only while bytes are being sent.
      if (state.phase !== "uploading") return state;
      return {
        ...state,
        progress: Math.max(state.progress, Math.min(100, action.percent)),
      };
    case "uploaded":
      if (state.phase !== "uploading") return state;
      return { phase: "processing", file: state.file };
    case "success":
      if (state.phase !== "uploading" && state.phase !== "processing") return state;
      return { phase: "ready", file: state.file, result: action.result };
    case "fail":
      return {
        phase: "error",
        file: action.file,
        code: action.code,
        source: action.source,
      };
    case "reset":
      return initialUploadState;
  }
}

export function useUpload() {
  const [state, dispatch] = useReducer(uploadReducer, initialUploadState);
  const controller = useRef<AbortController | null>(null);

  const select = useCallback(async (file: File) => {
    controller.current?.abort();
    const descriptor = { name: file.name, size: file.size };

    const check = checkResumeFile(file);
    if (!check.ok) {
      dispatch({ type: "fail", file: descriptor, code: check.code, source: "client" });
      return;
    }

    const abort = new AbortController();
    controller.current = abort;
    dispatch({ type: "start", file: descriptor });

    const outcome = await uploadResume(file, {
      signal: abort.signal,
      onProgress: (percent) => dispatch({ type: "progress", percent }),
      onUploaded: () => dispatch({ type: "uploaded" }),
    });

    // A newer selection or a cancel has taken over; ignore this result.
    if (controller.current !== abort) return;
    controller.current = null;

    if (outcome.ok) {
      dispatch({ type: "success", result: outcome.data });
    } else if (outcome.code === "ABORTED") {
      dispatch({ type: "reset" });
    } else {
      dispatch({ type: "fail", file: descriptor, code: outcome.code, source: "server" });
    }
  }, []);

  /** Rejects a selection that never reached validation, e.g. several files dropped at once. */
  const reject = useCallback((code: UploadErrorCode) => {
    controller.current?.abort();
    controller.current = null;
    dispatch({ type: "fail", file: null, code, source: "client" });
  }, []);

  const cancel = useCallback(() => {
    const active = controller.current;
    controller.current = null;
    active?.abort();
    dispatch({ type: "reset" });
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    dispatch({ type: "reset" });
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  return { state, select, reject, cancel, reset };
}
