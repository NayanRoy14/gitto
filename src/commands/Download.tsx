import React from "react";
import { useApp } from "ink";
import { Task } from "../ui/Task.js";
import { download } from "../lib/git.js";

interface DownloadProps {
  url: string;
  destination?: string;
  onDone?: (ok: boolean) => void;
}

export function Download({ url, destination, onDone }: DownloadProps) {
  const { exit } = useApp();

  return (
    <Task
      label={`Downloading ${url}...`}
      run={async () => {
        const result = await download(url, destination);
        return `Downloaded into ${result.path}.`;
      }}
      onDone={onDone ?? (() => setTimeout(() => exit(), 50))}
      interactive={Boolean(onDone)}
    />
  );
}
