import React, { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { configExists } from "../lib/config.js";
import { isLoggedIn } from "../lib/auth.js";
import { isGitRepo, initRepo } from "../lib/git.js";
import { Login } from "./Login.js";
import { Upload } from "./Upload.js";
import { Download } from "./Download.js";
import { Status } from "./Status.js";
import { Sync } from "./Sync.js";
import { Save } from "./Save.js";
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

type CommandName =
  | "upload"
  | "download"
  | "status"
  | "sync"
  | "save"
  | "branch"
  | "switch"
  | "combine"
  | "history"
  | "undo"
  | "trash"
  | "stash"
  | "request"
  | "issue"
  | "fork"
  | "collab"
  | "rebase"
  | "pick"
  | "tag";

interface AppProps {
  command: CommandName;
  url?: string;
  destination?: string;
}

type Step =
  | "greeting"
  | "login"
  | "repo-check"
  | "repo-prompt"
  | "initializing"
  | "run"
  | "cancelled";

const NEEDS_REPO: CommandName[] = [
  "upload",
  "status",
  "sync",
  "save",
  "branch",
  "switch",
  "combine",
  "history",
  "undo",
  "trash",
  "stash",
  "request",
  "issue",
  "fork",
  "collab",
  "rebase",
  "pick",
  "tag",
];

export function App({ command, url, destination }: AppProps) {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>(configExists() ? "repo-check" : "greeting");
  const [repoError, setRepoError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== "greeting") return;
    const timer = setTimeout(() => {
      setStep(isLoggedIn() ? "repo-check" : "login");
    }, 900);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step !== "repo-check") return;
    if (!NEEDS_REPO.includes(command)) {
      setStep("run");
      return;
    }
    isGitRepo().then((yes) => setStep(yes ? "run" : "repo-prompt"));
  }, [step, command]);

  useInput(
    (input, key) => {
      if (key.return) {
        setStep("initializing");
        initRepo()
          .then(() => setStep("run"))
          .catch((err: unknown) => {
            setRepoError(err instanceof Error ? err.message : String(err));
            setStep("cancelled");
          });
      }
      if (input.toLowerCase() === "n") {
        setStep("cancelled");
        setTimeout(() => exit(), 50);
      }
    },
    { isActive: step === "repo-prompt" }
  );

  if (step === "greeting") {
    return (
      <Box flexDirection="column">
        <Text bold>Welcome to gitto.</Text>
        <Text>Plain-language Git and GitHub — no jargon required.</Text>
      </Box>
    );
  }

  if (step === "login") {
    return (
      <Box flexDirection="column">
        <Text color="yellow">You're not connected to GitHub yet.</Text>
        <Login onComplete={() => setStep("repo-check")} />
      </Box>
    );
  }

  if (step === "repo-check") {
    return (
      <Box>
        <Text dimColor>Checking this folder...</Text>
      </Box>
    );
  }

  if (step === "repo-prompt") {
    return (
      <Box flexDirection="column">
        <Text color="yellow">This folder isn't a git project yet.</Text>
        <Text>Press Enter to set one up, or N to cancel.</Text>
      </Box>
    );
  }

  if (step === "initializing") {
    return (
      <Box>
        <Text dimColor>Setting up this folder...</Text>
      </Box>
    );
  }

  if (step === "cancelled") {
    return (
      <Box>
        <Text color="red">{repoError ?? "Cancelled."}</Text>
      </Box>
    );
  }

  switch (command) {
    case "upload":
      return <Upload />;
    case "status":
      return <Status />;
    case "download":
      return <Download url={url!} destination={destination} />;
    case "sync":
      return <Sync />;
    case "save":
      return <Save />;
    case "branch":
      return <Branch />;
    case "switch":
      return <Switch />;
    case "combine":
      return <Combine />;
    case "history":
      return <History />;
    case "undo":
      return <Undo />;
    case "trash":
      return <Trash />;
    case "stash":
      return <Stash />;
    case "request":
      return <Request />;
    case "issue":
      return <Issue />;
    case "fork":
      return <Fork />;
    case "collab":
      return <Collab />;
    case "rebase":
      return <Rebase />;
    case "pick":
      return <Pick />;
    case "tag":
      return <Tag />;
  }
}
