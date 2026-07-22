import React, { useState } from "react";
import { useApp } from "ink";
import { Confirm } from "../ui/Confirm.js";
import { Task } from "../ui/Task.js";
import { undoLastSave } from "../lib/git.js";

interface UndoProps {
  onDone?: (ok: boolean) => void;
}

export function Undo({ onDone }: UndoProps = {}) {
  const { exit } = useApp();
  const finish = onDone ?? (() => setTimeout(() => exit(), 50));
  const [confirmed, setConfirmed] = useState(false);

  if (!confirmed) {
    return (
      <Confirm
        message="Undo your last save?"
        onAnswer={(yes) => {
          if (yes) setConfirmed(true);
          else finish(false);
        }}
      />
    );
  }

  return (
    <Task
      label="Undoing your last save..."
      run={() => undoLastSave()}
      onDone={finish}
      interactive={Boolean(onDone)}
    />
  );
}
