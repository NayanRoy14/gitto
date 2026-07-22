import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Prompt } from "../ui/Prompt.js";
import { Confirm } from "../ui/Confirm.js";
import { Task } from "../ui/Task.js";
import { Result } from "../ui/Result.js";
import { save, getInProgressOperation, getSavePreflight, SensitiveFilesError } from "../lib/git.js";

interface SaveProps {
  onDone?: (ok: boolean) => void;
}

type Step =
  | { kind: "loading" }
  | { kind: "continuing" }
  | { kind: "merging" }
  | { kind: "which-files" }
  | { kind: "checking-files"; onlyPaths: string[] }
  | { kind: "blocked"; message: string }
  | { kind: "confirm-exclude"; flagged: string[]; onlyPaths: string[] }
  | { kind: "confirm-anyway"; flagged: string[]; onlyPaths: string[] }
  | { kind: "prompt"; excludePaths: string[]; onlyPaths: string[] }
  | { kind: "saving"; message: string; excludePaths: string[]; onlyPaths: string[] };

export function Save({ onDone }: SaveProps = {}) {
  const { exit } = useApp();
  const finish = onDone ?? (() => setTimeout(() => exit(), 50));
  const [step, setStep] = useState<Step>({ kind: "loading" });

  useEffect(() => {
    if (step.kind !== "loading") return;
    getInProgressOperation().then((op) => {
      if (op === "rebase" || op === "cherry-pick") {
        setStep({ kind: "continuing" });
      } else if (op === "merge") {
        setStep({ kind: "merging" });
      } else {
        setStep({ kind: "which-files" });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  useEffect(() => {
    if (step.kind !== "checking-files") return;
    getSavePreflight(undefined, step.onlyPaths).then((preflight) => {
      if (preflight.hardBlocked.length > 0) {
        setStep({ kind: "blocked", message: new SensitiveFilesError(preflight.hardBlocked).message });
      } else if (preflight.flagged.length > 0) {
        setStep({ kind: "confirm-exclude", flagged: preflight.flagged, onlyPaths: step.onlyPaths });
      } else {
        setStep({ kind: "prompt", excludePaths: [], onlyPaths: step.onlyPaths });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  if (step.kind === "loading" || step.kind === "checking-files") {
    return (
      <Box>
        <Text dimColor>Checking this folder...</Text>
      </Box>
    );
  }

  if (step.kind === "continuing") {
    return (
      <Task label="Continuing..." run={() => save("")} onDone={finish} interactive={Boolean(onDone)} />
    );
  }

  if (step.kind === "merging") {
    return (
      <Prompt
        message="What did you change?"
        placeholder="describe your changes"
        onSubmit={(value) =>
          setStep({ kind: "saving", message: value.trim() || "Merge", excludePaths: [], onlyPaths: [] })
        }
      />
    );
  }

  if (step.kind === "which-files") {
    return (
      <Prompt
        message="Save everything, or just some files/folders?"
        placeholder="leave blank for everything"
        onSubmit={(value) => {
          const onlyPaths = value.trim() ? value.trim().split(/\s+/) : [];
          setStep({ kind: "checking-files", onlyPaths });
        }}
      />
    );
  }

  if (step.kind === "blocked") {
    return <Result tone="error" message={step.message} onDone={onDone} />;
  }

  if (step.kind === "confirm-exclude") {
    return (
      <Box flexDirection="column">
        <Text color="yellow">These usually shouldn't be saved:</Text>
        {step.flagged.map((f) => (
          <Text key={f}> • {f}</Text>
        ))}
        <Confirm
          message="Exclude them and save everything else?"
          onAnswer={(yes) =>
            setStep(
              yes
                ? { kind: "prompt", excludePaths: step.flagged, onlyPaths: step.onlyPaths }
                : { kind: "confirm-anyway", flagged: step.flagged, onlyPaths: step.onlyPaths }
            )
          }
        />
      </Box>
    );
  }

  if (step.kind === "confirm-anyway") {
    return (
      <Confirm
        message="Are you sure you want to save them anyway?"
        onAnswer={(yes) =>
          yes
            ? setStep({ kind: "prompt", excludePaths: [], onlyPaths: step.onlyPaths })
            : finish(false)
        }
      />
    );
  }

  if (step.kind === "prompt") {
    return (
      <Prompt
        message="What did you change?"
        placeholder="describe your changes"
        onSubmit={(value) =>
          setStep({
            kind: "saving",
            message: value.trim() || "Update",
            excludePaths: step.excludePaths,
            onlyPaths: step.onlyPaths,
          })
        }
      />
    );
  }

  return (
    <Task
      label="Saving your changes..."
      run={() => save(step.message, undefined, step.excludePaths, step.onlyPaths)}
      onDone={finish}
      interactive={Boolean(onDone)}
    />
  );
}
