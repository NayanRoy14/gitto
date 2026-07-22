import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Task } from "../ui/Task.js";
import { Result } from "../ui/Result.js";
import { getStatus, hasStash, stashChanges, restoreStash } from "../lib/git.js";

interface StashProps {
  onDone?: (ok: boolean) => void;
}

type Action = "stash" | "restore" | "none";

export function Stash({ onDone }: StashProps = {}) {
  const { exit } = useApp();
  const finish = onDone ?? (() => setTimeout(() => exit(), 50));
  const [action, setAction] = useState<Action | null>(null);

  useEffect(() => {
    (async () => {
      const status = await getStatus();
      if (status.changedFiles > 0) {
        setAction("stash");
        return;
      }
      setAction((await hasStash()) ? "restore" : "none");
    })();
  }, []);

  if (action === null) {
    return (
      <Box>
        <Text dimColor>Checking for changes...</Text>
      </Box>
    );
  }

  if (action === "none") {
    return (
      <Result
        tone="info"
        message="Nothing to stash away and nothing stashed to bring back."
        onDone={onDone}
      />
    );
  }

  if (action === "stash") {
    return (
      <Task
        label="Stashing your changes..."
        run={() => stashChanges()}
        onDone={finish}
        interactive={Boolean(onDone)}
      />
    );
  }

  return (
    <Task
      label="Bringing back your stash..."
      run={() => restoreStash()}
      onDone={finish}
      interactive={Boolean(onDone)}
    />
  );
}
