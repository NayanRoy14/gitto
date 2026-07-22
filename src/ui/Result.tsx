import React, { useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";

interface ResultProps {
  tone: "success" | "error" | "info";
  message: string;
  onDone?: (ok: boolean) => void;
}

export function Result({ tone, message, onDone }: ResultProps) {
  const { exit } = useApp();
  const embedded = Boolean(onDone);
  const ok = tone !== "error";
  const finish = onDone ?? (() => exit());

  useEffect(() => {
    if (embedded) return;
    const timer = setTimeout(() => finish(ok), 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInput(() => finish(ok), { isActive: embedded });

  const color = tone === "error" ? "red" : tone === "success" ? "green" : "yellow";
  const icon = tone === "error" ? "✗ " : tone === "success" ? "✓ " : "";

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={color}>{icon}</Text>
        <Text>{message}</Text>
      </Box>
      {embedded && <Text dimColor>Press Enter to continue.</Text>}
    </Box>
  );
}
