import React, { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import { getHistory, type HistoryEntry } from "../lib/git.js";

interface HistoryProps {
  onDone?: (ok: boolean) => void;
}

type Phase =
  | { kind: "loading" }
  | { kind: "done"; entries: HistoryEntry[] }
  | { kind: "error"; message: string };

export function History({ onDone }: HistoryProps = {}) {
  const { exit } = useApp();
  const embedded = Boolean(onDone);
  const finish = onDone ?? (() => exit());
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    getHistory()
      .then((entries) => setPhase({ kind: "done", entries }))
      .catch((err: unknown) =>
        setPhase({ kind: "error", message: err instanceof Error ? err.message : String(err) })
      );
  }, []);

  useEffect(() => {
    if (embedded) return;
    if (phase.kind === "loading") return;
    const timer = setTimeout(() => finish(phase.kind === "done"), 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useInput(() => finish(phase.kind === "done"), {
    isActive: embedded && phase.kind !== "loading",
  });

  if (phase.kind === "loading") {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> Looking up your history...</Text>
      </Box>
    );
  }

  if (phase.kind === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {phase.message}</Text>
        {embedded && <Text dimColor>Press Enter to continue.</Text>}
      </Box>
    );
  }

  if (phase.entries.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">Nothing saved yet.</Text>
        {embedded && <Text dimColor>Press Enter to continue.</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {phase.entries.map((entry) => (
        <Box key={entry.hash}>
          <Text color="yellow">{entry.hash} </Text>
          <Text>{entry.message} </Text>
          <Text dimColor>
            — {entry.author}, {new Date(entry.date).toLocaleString()}
          </Text>
        </Box>
      ))}
      {embedded && (
        <Box marginTop={1}>
          <Text dimColor>Press Enter to continue.</Text>
        </Box>
      )}
    </Box>
  );
}
