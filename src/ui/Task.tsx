import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";

interface TaskProps {
  label: string;
  run: () => Promise<string>;
  onDone: (ok: boolean) => void;
  interactive?: boolean;
}

type Phase =
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function Task({ label, run, onDone, interactive = false }: TaskProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    run()
      .then((message) => {
        if (cancelled) return;
        setPhase({ kind: "success", message });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setPhase({ kind: "error", message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (interactive) return;
    if (phase.kind === "success" || phase.kind === "error") {
      onDone(phase.kind === "success");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useInput(() => onDone(phase.kind === "success"), {
    isActive: interactive && phase.kind !== "loading",
  });

  if (phase.kind === "loading") {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> {label}</Text>
      </Box>
    );
  }

  if (phase.kind === "success") {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="green">✓ </Text>
          <Text>{phase.message}</Text>
        </Box>
        {interactive && <Text dimColor>Press Enter to continue.</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="red">✗ </Text>
        <Text>{phase.message}</Text>
      </Box>
      {interactive && <Text dimColor>Press Enter to continue.</Text>}
    </Box>
  );
}
