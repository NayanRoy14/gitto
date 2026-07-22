import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface PromptProps {
  message: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
}

export function Prompt({ message, placeholder, onSubmit }: PromptProps) {
  const [value, setValue] = useState("");

  return (
    <Box>
      <Text>{message} </Text>
      <TextInput value={value} onChange={setValue} onSubmit={onSubmit} placeholder={placeholder} />
    </Box>
  );
}
