import React, { useState } from "react";
import { useApp } from "ink";
import { Prompt } from "../ui/Prompt.js";
import { Task } from "../ui/Task.js";
import { createIssue } from "../lib/github.js";

interface IssueProps {
  onDone?: (ok: boolean) => void;
}

export function Issue({ onDone }: IssueProps = {}) {
  const { exit } = useApp();
  const [title, setTitle] = useState<string | null>(null);

  if (title === null) {
    return (
      <Prompt
        message="What's the issue?"
        placeholder="short summary"
        onSubmit={(value) => value.trim() && setTitle(value.trim())}
      />
    );
  }

  return (
    <Task
      label="Opening the issue..."
      run={() => createIssue({ title })}
      onDone={onDone ?? (() => setTimeout(() => exit(), 50))}
      interactive={Boolean(onDone)}
    />
  );
}
