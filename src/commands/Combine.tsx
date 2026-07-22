import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Select } from "../ui/Select.js";
import { Task } from "../ui/Task.js";
import { Result } from "../ui/Result.js";
import { listBranches, mergeBranch } from "../lib/git.js";

interface CombineProps {
  onDone?: (ok: boolean) => void;
}

export function Combine({ onDone }: CombineProps = {}) {
  const { exit } = useApp();
  const finish = onDone ?? (() => setTimeout(() => exit(), 50));
  const [branches, setBranches] = useState<string[] | null>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    listBranches().then((info) => setBranches(info.others));
  }, []);

  if (branches === null) {
    return (
      <Box>
        <Text dimColor>Looking up your lines...</Text>
      </Box>
    );
  }

  if (branches.length === 0) {
    return (
      <Result tone="info" message="There's only one line here — nothing to combine." onDone={onDone} />
    );
  }

  if (source === null) {
    return (
      <Select
        message="Combine which line into your current one?"
        items={branches.map((name) => ({ label: name, value: name }))}
        onSelect={setSource}
      />
    );
  }

  return (
    <Task
      label={`Combining "${source}"...`}
      run={() => mergeBranch(source)}
      onDone={finish}
      interactive={Boolean(onDone)}
    />
  );
}
