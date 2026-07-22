#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { Command } from "commander";
import { Login } from "./commands/Login.js";
import { App } from "./commands/App.js";
import { Palette } from "./commands/Palette.js";
import { runRepl, repl } from "./lib/repl.js";
import { createLineReader, type LineReader } from "./lib/lineReader.js";

const isInteractive = Boolean(process.stdin.isTTY);

async function runOnce(handler: (rl: LineReader) => Promise<void>): Promise<void> {
  const rl = createLineReader();
  try {
    await handler(rl);
  } finally {
    rl.close();
    process.exit(0);
  }
}

function inkOrRepl(command: string, handler: (rl: LineReader) => Promise<void>) {
  return () => {
    if (isInteractive) {
      render(<App command={command as never} />);
    } else {
      runOnce(handler);
    }
  };
}

const program = new Command();

program
  .name("gitto")
  .description("Plain-language Git & GitHub — no jargon required.")
  .version("0.1.0");

program.action(() => {
  if (isInteractive) {
    render(<Palette />);
  } else {
    runRepl().then(() => process.exit(0));
  }
});

program
  .command("login")
  .description("Connect your GitHub account")
  .action(() => {
    render(<Login />);
  });

program
  .command("upload")
  .description("Send your saved changes to GitHub")
  .action(inkOrRepl("upload", repl.upload));

program
  .command("download <url> [destination]")
  .description("Copy a GitHub project to your computer")
  .action((url: string, destination?: string) => {
    render(<App command="download" url={url} destination={destination} />);
  });

program
  .command("status")
  .description("See what's changed")
  .action(() => {
    render(<App command="status" />);
  });

program
  .command("sync")
  .description("Bring down the latest changes")
  .action(() => {
    render(<App command="sync" />);
  });

program
  .command("save")
  .description("Save your changes with a message")
  .action(inkOrRepl("save", repl.save));

program
  .command("branch")
  .alias("new-line")
  .description("Start a new line of work")
  .action(inkOrRepl("branch", repl.branch));

program
  .command("switch")
  .description("Move to a different line")
  .action(inkOrRepl("switch", repl.switch));

program
  .command("combine")
  .description("Bring another line into this one")
  .action(inkOrRepl("combine", repl.combine));

program
  .command("history")
  .description("See what's been saved")
  .action(() => {
    render(<App command="history" />);
  });

program
  .command("undo")
  .description("Undo your last save")
  .action(inkOrRepl("undo", repl.undo));

program
  .command("trash")
  .description("Delete a line you don't need")
  .action(inkOrRepl("trash", repl.trash));

program
  .command("stash")
  .description("Set changes aside for later, or bring them back")
  .action(() => {
    render(<App command="stash" />);
  });

program
  .command("request")
  .description("Ask to combine your line on GitHub")
  .action(inkOrRepl("request", repl.request));

program
  .command("issue")
  .description("Open a GitHub issue")
  .action(inkOrRepl("issue", repl.issue));

program
  .command("fork")
  .description("Copy this project to your own GitHub")
  .action(() => {
    render(<App command="fork" />);
  });

program
  .command("collab")
  .description("Invite someone to this project")
  .action(inkOrRepl("collab", repl.collab));

program
  .command("rebase")
  .description("Replay your changes on top of another line")
  .action(inkOrRepl("rebase", repl.rebase));

program
  .command("pick")
  .description("Bring one change from another line into this one")
  .action(inkOrRepl("pick", repl.pick));

program
  .command("tag")
  .description("Mark this point as a release")
  .action(inkOrRepl("tag", repl.tag));

program.parse();
