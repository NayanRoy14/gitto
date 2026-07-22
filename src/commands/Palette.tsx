import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Select } from "../ui/Select.js";
import { Confirm } from "../ui/Confirm.js";
import { configExists } from "../lib/config.js";
import { isLoggedIn } from "../lib/auth.js";
import { getRepoState, initRepo, type RepoState } from "../lib/git.js";
import { buildMenu, type CommandKey } from "../lib/menu.js";
import { Login } from "./Login.js";
import { Logout } from "./Logout.js";
import { Upload } from "./Upload.js";
import { DownloadFlow } from "./DownloadFlow.js";
import { Sync } from "./Sync.js";
import { Save } from "./Save.js";
import { Status } from "./Status.js";
import { Branch } from "./Branch.js";
import { Switch } from "./Switch.js";
import { Combine } from "./Combine.js";
import { History } from "./History.js";
import { Undo } from "./Undo.js";
import { Trash } from "./Trash.js";
import { Stash } from "./Stash.js";
import { Request } from "./Request.js";
import { Issue } from "./Issue.js";
import { Fork } from "./Fork.js";
import { Collab } from "./Collab.js";
import { Rebase } from "./Rebase.js";
import { Pick } from "./Pick.js";
import { Tag } from "./Tag.js";

type Step =
  | { kind: "greeting" }
  | { kind: "login" }
  | { kind: "loading" }
  | { kind: "repo-prompt" }
  | { kind: "initializing" }
  | { kind: "menu" }
  | { kind: "run"; command: CommandKey };

export function Palette() {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>(configExists() ? { kind: "loading" } : { kind: "greeting" });
  const [state, setState] = useState<RepoState | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    if (step.kind !== "greeting") return;
    const timer = setTimeout(() => {
      setStep(isLoggedIn() ? { kind: "loading" } : { kind: "login" });
    }, 900);
    return () => clearTimeout(timer);
  }, [step.kind]);

  useEffect(() => {
    if (step.kind !== "loading") return;
    Promise.all([getRepoState(), Promise.resolve(isLoggedIn())]).then(([s, li]) => {
      setState(s);
      setLoggedIn(li);
      setStep(s.isRepo ? { kind: "menu" } : { kind: "repo-prompt" });
    });
  }, [step.kind]);

  const refresh = () => setStep({ kind: "loading" });

  if (step.kind === "greeting") {
    return (
      <Box flexDirection="column">
        <Text bold>Welcome to gitto.</Text>
        <Text>Plain-language Git and GitHub — no jargon required.</Text>
      </Box>
    );
  }

  if (step.kind === "login") {
    return (
      <Box flexDirection="column">
        <Text color="yellow">You're not connected to GitHub yet.</Text>
        <Login onComplete={refresh} />
      </Box>
    );
  }

  if (step.kind === "loading" || !state) {
    return (
      <Box>
        <Text dimColor>Looking around...</Text>
      </Box>
    );
  }

  if (step.kind === "repo-prompt") {
    return (
      <Confirm
        message="This folder isn't a git project yet. Set one up?"
        onAnswer={(yes) => {
          if (!yes) {
            setStep({ kind: "menu" });
            return;
          }
          setStep({ kind: "initializing" });
          initRepo().then(refresh);
        }}
      />
    );
  }

  if (step.kind === "initializing") {
    return (
      <Box>
        <Text dimColor>Setting up this folder...</Text>
      </Box>
    );
  }

  if (step.kind === "menu") {
    return (
      <Select
        message="What would you like to do?"
        items={buildMenu(state, loggedIn).map((item) => ({
          label: item.label,
          value: item.key,
          description: item.description,
        }))}
        onSelect={(command) => {
          if (command === "quit") {
            exit();
            return;
          }
          setStep({ kind: "run", command });
        }}
      />
    );
  }

  switch (step.command) {
    case "upload":
      return <Upload onDone={refresh} />;
    case "download":
      return <DownloadFlow onDone={refresh} />;
    case "sync":
      return <Sync onDone={refresh} />;
    case "save":
      return <Save onDone={refresh} />;
    case "status":
      return <Status onDone={refresh} />;
    case "branch":
      return <Branch onDone={refresh} />;
    case "switch":
      return <Switch onDone={refresh} />;
    case "combine":
      return <Combine onDone={refresh} />;
    case "history":
      return <History onDone={refresh} />;
    case "undo":
      return <Undo onDone={refresh} />;
    case "trash":
      return <Trash onDone={refresh} />;
    case "stash":
      return <Stash onDone={refresh} />;
    case "request":
      return <Request onDone={refresh} />;
    case "issue":
      return <Issue onDone={refresh} />;
    case "fork":
      return <Fork onDone={refresh} />;
    case "collab":
      return <Collab onDone={refresh} />;
    case "rebase":
      return <Rebase onDone={refresh} />;
    case "pick":
      return <Pick onDone={refresh} />;
    case "tag":
      return <Tag onDone={refresh} />;
    case "login":
      return <Login onComplete={refresh} />;
    case "logout":
      return <Logout onDone={refresh} />;
    default:
      return null;
  }
}
