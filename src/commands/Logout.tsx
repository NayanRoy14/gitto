import React, { useState } from "react";
import { useApp } from "ink";
import { Confirm } from "../ui/Confirm.js";
import { Task } from "../ui/Task.js";
import { Result } from "../ui/Result.js";
import { isLoggedIn } from "../lib/auth.js";
import { clearConfig } from "../lib/config.js";

interface LogoutProps {
  onDone?: (ok: boolean) => void;
}

export function Logout({ onDone }: LogoutProps = {}) {
  const { exit } = useApp();
  const finish = onDone ?? (() => setTimeout(() => exit(), 50));
  const [confirmed, setConfirmed] = useState(false);

  if (!isLoggedIn()) {
    return <Result tone="info" message="You're not logged in." onDone={onDone} />;
  }

  if (!confirmed) {
    return (
      <Confirm
        message="Disconnect your GitHub account?"
        onAnswer={(yes) => {
          if (yes) setConfirmed(true);
          else finish(false);
        }}
      />
    );
  }

  return (
    <Task
      label="Logging out..."
      run={async () => {
        clearConfig();
        return "Logged out.";
      }}
      onDone={finish}
      interactive={Boolean(onDone)}
    />
  );
}
