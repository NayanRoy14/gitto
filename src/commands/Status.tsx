import React from "react";
import { useApp } from "ink";
import { Task } from "../ui/Task.js";
import { getStatus, findTrackedSecrets } from "../lib/git.js";

function describe(status: Awaited<ReturnType<typeof getStatus>>, secrets: string[]): string {
  const parts: string[] = [`On "${status.branch}".`];

  if (status.changedFiles > 0) {
    parts.push(
      `${status.changedFiles} file${status.changedFiles === 1 ? "" : "s"} changed and not yet saved.`,
    );
  }

  if (!status.connectedToGitHub) {
    parts.push("This project isn't connected to GitHub yet.");
  } else if (status.readyToUpload > 0) {
    parts.push(
      `${status.readyToUpload} commit${status.readyToUpload === 1 ? "" : "s"} ready to upload.`,
    );
  } else if (status.changedFiles === 0) {
    parts.push("Everything is up to date — nothing new to upload.");
  }

  if (secrets.length > 0) {
    parts.push(
      `\n⚠ These look like secrets and are already saved to this project's history: ${secrets.join(", ")}. Consider removing and rotating them.`,
    );
  }

  return parts.join(" ");
}

interface StatusProps {
  onDone?: (ok: boolean) => void;
}

export function Status({ onDone }: StatusProps = {}) {
  const { exit } = useApp();

  return (
    <Task
      label="Checking status..."
      run={async () => {
        const [status, secrets] = await Promise.all([getStatus(), findTrackedSecrets()]);
        return describe(status, secrets);
      }}
      onDone={onDone ?? (() => setTimeout(() => exit(), 50))}
      interactive={Boolean(onDone)}
    />
  );
}
