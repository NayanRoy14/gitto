import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey, settle } from "../testSupport/ink.js";

const mockUndoLastSave = vi.fn();
vi.mock("../lib/git.js", () => ({
  undoLastSave: () => mockUndoLastSave(),
}));

import { Undo } from "./Undo.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Undo", () => {
  it("undoes the last save after confirmation", async () => {
    mockUndoLastSave.mockResolvedValue("Undid your last save.");

    const { lastFrame, stdin } = render(<Undo />);
    await settle();

    expect(lastFrame()).toContain("Undo your last save?");
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Undid your last save.");
    });
  });

  it("does nothing when declined", async () => {
    const { stdin } = render(<Undo />);
    await settle();
    await pressKey(stdin, "n");
    expect(mockUndoLastSave).not.toHaveBeenCalled();
  });

  it("shows the error when undo fails", async () => {
    mockUndoLastSave.mockRejectedValue(new Error("There's nothing saved yet."));

    const { lastFrame, stdin } = render(<Undo />);
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("There's nothing saved yet.");
    });
  });
});
