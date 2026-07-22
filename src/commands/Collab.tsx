import React, { useState } from "react";
import { useApp } from "ink";
import { Prompt } from "../ui/Prompt.js";
import { Task } from "../ui/Task.js";
import { addCollaborator } from "../lib/github.js";

interface CollabProps {
  onDone?: (ok: boolean) => void;
}

export function Collab({ onDone }: CollabProps = {}) {
  const { exit } = useApp();
  const [username, setUsername] = useState<string | null>(null);

  if (username === null) {
    return (
      <Prompt
        message="Who should be invited? (GitHub username)"
        placeholder="octocat"
        onSubmit={(value) => value.trim() && setUsername(value.trim())}
      />
    );
  }

  return (
    <Task
      label={`Inviting ${username}...`}
      run={() => addCollaborator(username)}
      onDone={onDone ?? (() => setTimeout(() => exit(), 50))}
      interactive={Boolean(onDone)}
    />
  );
}
