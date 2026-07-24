import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Prompt } from "../ui/Prompt.js";
import { Confirm } from "../ui/Confirm.js";
import { Task } from "../ui/Task.js";
import { Result } from "../ui/Result.js";
import { createTag, pushTag, getRepoState } from "../lib/git.js";
import { isLoggedIn } from "../lib/auth.js";

interface TagProps {
  onDone?: (ok: boolean) => void;
}

type Step =
  | { kind: "name" }
  | { kind: "message"; name: string }
  | { kind: "creating"; name: string; message: string }
  | { kind: "created-error"; message: string }
  | { kind: "checking-push"; name: string }
  | { kind: "confirm-push"; name: string }
  | { kind: "pushing"; name: string }
  | { kind: "done"; name: string };

export function Tag({ onDone }: TagProps = {}) {
  const { exit } = useApp();
  const finish = onDone ?? (() => setTimeout(() => exit(), 50));
  const [step, setStep] = useState<Step>({ kind: "name" });

  useEffect(() => {
    if (step.kind !== "creating") return;
    createTag(step.name, step.message)
      .then(() => setStep({ kind: "checking-push", name: step.name }))
      .catch((err: unknown) =>
        setStep({
          kind: "created-error",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
  }, [step]);

  useEffect(() => {
    if (step.kind !== "checking-push") return;
    Promise.all([getRepoState(), Promise.resolve(isLoggedIn())]).then(([state, loggedIn]) => {
      setStep(
        state.hasRemote && loggedIn
          ? { kind: "confirm-push", name: step.name }
          : { kind: "done", name: step.name },
      );
    });
  }, [step]);

  if (step.kind === "name") {
    return (
      <Prompt
        message="Name for this tag:"
        placeholder="e.g. v1.0.0"
        onSubmit={(value) => value.trim() && setStep({ kind: "message", name: value.trim() })}
      />
    );
  }

  if (step.kind === "message") {
    return (
      <Prompt
        message="Message for this tag:"
        placeholder={step.name}
        onSubmit={(value) =>
          setStep({ kind: "creating", name: step.name, message: value.trim() || step.name })
        }
      />
    );
  }

  if (step.kind === "creating" || step.kind === "checking-push") {
    return (
      <Box>
        <Text dimColor>
          {step.kind === "creating" ? "Tagging..." : "Checking GitHub connection..."}
        </Text>
      </Box>
    );
  }

  if (step.kind === "created-error") {
    return <Result tone="error" message={step.message} onDone={onDone} />;
  }

  if (step.kind === "confirm-push") {
    return (
      <Confirm
        message="Upload this tag to GitHub now?"
        onAnswer={(yes) =>
          setStep(yes ? { kind: "pushing", name: step.name } : { kind: "done", name: step.name })
        }
      />
    );
  }

  if (step.kind === "pushing") {
    return (
      <Task
        label="Uploading tag..."
        run={() => pushTag(step.name)}
        onDone={finish}
        interactive={Boolean(onDone)}
      />
    );
  }

  return <Result tone="success" message={`Tagged this point as "${step.name}".`} onDone={onDone} />;
}
