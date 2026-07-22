import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Select } from "../ui/Select.js";
import { Task } from "../ui/Task.js";
import { Result } from "../ui/Result.js";
import { listBranches, getBranchHistory, pickCommit, type HistoryEntry } from "../lib/git.js";

interface PickProps {
  onDone?: (ok: boolean) => void;
}

export function Pick({ onDone }: PickProps = {}) {
  const { exit } = useApp();
  const finish = onDone ?? (() => setTimeout(() => exit(), 50));
  const [branches, setBranches] = useState<string[] | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    listBranches().then((info) => setBranches(info.others));
  }, []);

  useEffect(() => {
    if (source === null) return;
    getBranchHistory(source).then(setEntries);
  }, [source]);

  if (branches === null) {
    return (
      <Box>
        <Text dimColor>Looking up your lines...</Text>
      </Box>
    );
  }

  if (branches.length === 0) {
    return (
      <Result
        tone="info"
        message="There's only one line here — nothing to pick from."
        onDone={onDone}
      />
    );
  }

  if (source === null) {
    return (
      <Select
        message="Pick a change from which line?"
        items={branches.map((name) => ({ label: name, value: name }))}
        onSelect={setSource}
      />
    );
  }

  if (entries === null) {
    return (
      <Box>
        <Text dimColor>Looking up what's been saved there...</Text>
      </Box>
    );
  }

  if (entries.length === 0) {
    return (
      <Result tone="info" message="That line has nothing saved to pick from." onDone={onDone} />
    );
  }

  if (hash === null) {
    return (
      <Select
        message="Bring which change into your current line?"
        items={entries.map((entry) => ({
          label: `${entry.hash} ${entry.message}`,
          value: entry.hash,
        }))}
        onSelect={setHash}
      />
    );
  }

  return (
    <Task
      label="Bringing that change over..."
      run={() => pickCommit(hash)}
      onDone={finish}
      interactive={Boolean(onDone)}
    />
  );
}
