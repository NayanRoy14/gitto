import React from "react";
import { useApp } from "ink";
import { Task } from "../ui/Task.js";
import { forkRepo } from "../lib/github.js";

interface ForkProps {
  onDone?: (ok: boolean) => void;
}

export function Fork({ onDone }: ForkProps = {}) {
  const { exit } = useApp();

  return (
    <Task
      label="Forking this project..."
      run={() => forkRepo()}
      onDone={onDone ?? (() => setTimeout(() => exit(), 50))}
      interactive={Boolean(onDone)}
    />
  );
}
