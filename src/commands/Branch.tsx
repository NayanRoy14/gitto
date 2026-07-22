import React, { useState } from "react";
import { useApp } from "ink";
import { Prompt } from "../ui/Prompt.js";
import { Task } from "../ui/Task.js";
import { createBranch } from "../lib/git.js";

interface BranchProps {
  onDone?: (ok: boolean) => void;
}

export function Branch({ onDone }: BranchProps = {}) {
  const { exit } = useApp();
  const [name, setName] = useState<string | null>(null);

  if (name === null) {
    return (
      <Prompt
        message="Name for the new line:"
        placeholder="e.g. fix-login-bug"
        onSubmit={(value) => value.trim() && setName(value.trim())}
      />
    );
  }

  return (
    <Task
      label={`Creating "${name}"...`}
      run={() => createBranch(name)}
      onDone={onDone ?? (() => setTimeout(() => exit(), 50))}
      interactive={Boolean(onDone)}
    />
  );
}
