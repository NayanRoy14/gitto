import React from "react";
import { useApp } from "ink";
import { Task } from "../ui/Task.js";
import { sync } from "../lib/git.js";

interface SyncProps {
  onDone?: (ok: boolean) => void;
}

export function Sync({ onDone }: SyncProps = {}) {
  const { exit } = useApp();

  return (
    <Task
      label="Bringing down the latest changes..."
      run={() => sync()}
      onDone={onDone ?? (() => setTimeout(() => exit(), 50))}
      interactive={Boolean(onDone)}
    />
  );
}
