import React from "react";
import { Box, Text, useInput } from "ink";

interface ConfirmProps {
  message: string;
  onAnswer: (yes: boolean) => void;
}

export function Confirm({ message, onAnswer }: ConfirmProps) {
  useInput((input, key) => {
    if (key.return || input.toLowerCase() === "y") {
      onAnswer(true);
    } else if (input.toLowerCase() === "n" || key.escape) {
      onAnswer(false);
    }
  });

  return (
    <Box flexDirection="column">
      <Text color="yellow">{message}</Text>
      <Text dimColor>Press Enter or Y to confirm, N to cancel.</Text>
    </Box>
  );
}
