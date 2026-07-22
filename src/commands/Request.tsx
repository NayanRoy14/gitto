import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Select } from "../ui/Select.js";
import { Prompt } from "../ui/Prompt.js";
import { Task } from "../ui/Task.js";
import { Result } from "../ui/Result.js";
import { listBranches } from "../lib/git.js";
import { createRequest } from "../lib/github.js";

interface RequestProps {
  onDone?: (ok: boolean) => void;
}

function sortBranches(names: string[]): string[] {
  const priority = (name: string) => (name === "main" ? 0 : name === "master" ? 1 : 2);
  return [...names].sort((a, b) => priority(a) - priority(b));
}

export function Request({ onDone }: RequestProps = {}) {
  const { exit } = useApp();
  const finish = onDone ?? (() => setTimeout(() => exit(), 50));
  const [current, setCurrent] = useState<string | null>(null);
  const [others, setOthers] = useState<string[] | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    listBranches().then((info) => {
      setCurrent(info.current);
      setOthers(sortBranches(info.others));
    });
  }, []);

  if (others === null || current === null) {
    return (
      <Box>
        <Text dimColor>Looking up your lines...</Text>
      </Box>
    );
  }

  if (others.length === 0) {
    return (
      <Result
        tone="info"
        message="There's only one line here — nothing to request against."
        onDone={onDone}
      />
    );
  }

  if (base === null) {
    return (
      <Select
        message={`Request that "${current}" be combined into which line?`}
        items={others.map((name) => ({ label: name, value: name }))}
        onSelect={setBase}
      />
    );
  }

  if (title === null) {
    return (
      <Prompt
        message="Title for the request:"
        placeholder="short summary of your changes"
        onSubmit={(value) => value.trim() && setTitle(value.trim())}
      />
    );
  }

  return (
    <Task
      label="Opening the request..."
      run={() => createRequest({ title, head: current, base })}
      onDone={finish}
      interactive={Boolean(onDone)}
    />
  );
}
