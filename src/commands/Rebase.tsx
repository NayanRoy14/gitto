import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Select } from "../ui/Select.js";
import { Task } from "../ui/Task.js";
import { Result } from "../ui/Result.js";
import { listBranches, rebaseBranch } from "../lib/git.js";

interface RebaseProps {
  onDone?: (ok: boolean) => void;
}

export function Rebase({ onDone }: RebaseProps = {}) {
  const { exit } = useApp();
  const finish = onDone ?? (() => setTimeout(() => exit(), 50));
  const [branches, setBranches] = useState<string[] | null>(null);
  const [target, setTarget] = useState<string | null>(null);

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
      <Result tone="info" message="There's only one line here — nothing to replay onto." onDone={onDone} />
    );
  }

  if (target === null) {
    return (
      <Select
        message="Replay your changes on top of which line?"
        items={branches.map((name) => ({ label: name, value: name }))}
        onSelect={setTarget}
      />
    );
  }

  return (
    <Task
      label={`Replaying on top of "${target}"...`}
      run={() => rebaseBranch(target)}
      onDone={finish}
      interactive={Boolean(onDone)}
    />
  );
}
