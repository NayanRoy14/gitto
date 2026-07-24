import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Select } from "../ui/Select.js";
import { Confirm } from "../ui/Confirm.js";
import { Result } from "../ui/Result.js";
import { listBranches, deleteBranch, UnmergedBranchError } from "../lib/git.js";

interface TrashProps {
  onDone?: (ok: boolean) => void;
}

type Step =
  | { kind: "loading" }
  | { kind: "no-branches" }
  | { kind: "pick" }
  | { kind: "confirm"; target: string }
  | { kind: "deleting"; target: string; force: boolean }
  | { kind: "confirm-force"; target: string }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

export function Trash({ onDone }: TrashProps = {}) {
  const { exit } = useApp();
  const finish = onDone ?? (() => setTimeout(() => exit(), 50));
  const [branches, setBranches] = useState<string[] | null>(null);
  const [step, setStep] = useState<Step>({ kind: "loading" });

  useEffect(() => {
    listBranches().then((info) => {
      setBranches(info.others);
      setStep(info.others.length === 0 ? { kind: "no-branches" } : { kind: "pick" });
    });
  }, []);

  useEffect(() => {
    if (step.kind !== "deleting") return;
    deleteBranch(step.target, step.force)
      .then((message) => setStep({ kind: "done", message }))
      .catch((err: unknown) => {
        if (!step.force && err instanceof UnmergedBranchError) {
          setStep({ kind: "confirm-force", target: step.target });
          return;
        }
        setStep({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      });
  }, [step]);

  if (branches === null || step.kind === "loading") {
    return (
      <Box>
        <Text dimColor>Looking up your lines...</Text>
      </Box>
    );
  }

  if (step.kind === "no-branches") {
    return (
      <Result
        tone="info"
        message="There's only one line here — nothing to trash."
        onDone={onDone}
      />
    );
  }

  if (step.kind === "pick") {
    return (
      <Select
        message="Trash which line?"
        items={branches.map((name) => ({ label: name, value: name }))}
        onSelect={(target) => setStep({ kind: "confirm", target })}
      />
    );
  }

  if (step.kind === "confirm") {
    return (
      <Confirm
        message={`Trash "${step.target}"? This can't be undone.`}
        onAnswer={(yes) =>
          yes ? setStep({ kind: "deleting", target: step.target, force: false }) : finish(false)
        }
      />
    );
  }

  if (step.kind === "confirm-force") {
    return (
      <Confirm
        message={`"${step.target}" has changes that haven't been combined anywhere else yet. Trash it anyway?`}
        onAnswer={(yes) =>
          yes ? setStep({ kind: "deleting", target: step.target, force: true }) : finish(false)
        }
      />
    );
  }

  if (step.kind === "deleting") {
    return (
      <Box>
        <Text dimColor>Trashing "{step.target}"...</Text>
      </Box>
    );
  }

  if (step.kind === "error") {
    return <Result tone="error" message={step.message} onDone={onDone} />;
  }

  return <Result tone="success" message={step.message} onDone={onDone} />;
}
