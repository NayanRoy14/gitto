import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

export interface SelectItem<V> {
  label: string;
  value: V;
  description?: string;
}

interface SelectProps<V> {
  message?: string;
  items: SelectItem<V>[];
  onSelect: (value: V) => void;
}

export function Select<V>({ message, items, onSelect }: SelectProps<V>) {
  return (
    <Box flexDirection="column">
      {message && <Text>{message}</Text>}
      <SelectInput
        items={items}
        onSelect={(item) => onSelect(item.value)}
        itemComponent={({ isSelected, label }) => {
          const item = items.find((i) => i.label === label);
          return (
            <Text color={isSelected ? "cyan" : undefined}>
              {label}
              {item?.description ? <Text dimColor> — {item.description}</Text> : null}
            </Text>
          );
        }}
      />
    </Box>
  );
}
