import type { RepoState } from "./git.js";

export type CommandKey =
  | "upload"
  | "download"
  | "sync"
  | "save"
  | "status"
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
  | "tag"
  | "login"
  | "logout"
  | "quit";

export interface MenuItem {
  key: CommandKey;
  label: string;
  description: string;
}

export function buildMenu(state: RepoState, loggedIn: boolean): MenuItem[] {
  const items: MenuItem[] = [];
  const gh = state.isRepo && state.hasRemote && loggedIn;

  items.push({ key: "download", label: "download", description: "Copy a GitHub project here" });

  if (state.isRepo) {
    if (state.hasChanges) {
      items.push({
        key: "save",
        label: "save",
        description: state.inProgress
          ? "Fix conflicts and continue"
          : "Save your changes with a message",
      });
    }
    if (state.hasRemote && state.hasUnpushed) {
      items.push({
        key: "upload",
        label: "upload",
        description: "Send your saved changes to GitHub",
      });
    }
    if (state.hasRemote) {
      items.push({ key: "sync", label: "sync", description: "Bring down the latest changes" });
    }
    items.push({ key: "status", label: "status", description: "See what's changed" });
    items.push({ key: "branch", label: "new line", description: "Start a new line of work" });
    if (state.otherBranches.length > 0) {
      items.push({ key: "switch", label: "switch", description: "Move to a different line" });
      items.push({
        key: "combine",
        label: "combine",
        description: "Bring another line into this one",
      });
      items.push({
        key: "rebase",
        label: "rebase",
        description: "Replay your changes on top of another line",
      });
      items.push({
        key: "pick",
        label: "pick",
        description: "Bring one change from another line into this one",
      });
      items.push({ key: "trash", label: "trash", description: "Delete a line you don't need" });
    }
    if (state.hasCommits) {
      items.push({ key: "history", label: "history", description: "See what's been saved" });
      items.push({
        key: "undo",
        label: "undo",
        description: state.inProgress ? "Cancel and go back" : "Undo your last save",
      });
      items.push({ key: "tag", label: "tag", description: "Mark this point as a release" });
    }
    if (state.hasChanges || state.hasStash) {
      items.push({ key: "stash", label: "stash", description: "Set changes aside for later" });
    }
    if (gh) {
      items.push({
        key: "request",
        label: "request",
        description: "Ask to combine your line on GitHub",
      });
      items.push({ key: "issue", label: "issue", description: "Open a GitHub issue" });
      items.push({
        key: "fork",
        label: "fork",
        description: "Copy this project to your own GitHub",
      });
      items.push({ key: "collab", label: "collab", description: "Invite someone to this project" });
    }
  }

  items.push({
    key: "login",
    label: "login",
    description: loggedIn ? "Switch GitHub account" : "Connect your GitHub account",
  });
  if (loggedIn) {
    items.push({ key: "logout", label: "logout", description: "Disconnect your GitHub account" });
  }
  items.push({ key: "quit", label: "quit", description: "Exit gitto" });

  return items;
}
