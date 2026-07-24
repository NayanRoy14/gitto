import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey, settle, typeText } from "../testSupport/ink.js";

const mockCreateBranch = vi.fn();
vi.mock("../lib/git.js", () => ({
  createBranch: (...args: unknown[]) => mockCreateBranch(...args),
}));

import { Branch } from "./Branch.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Branch", () => {
  it("creates a branch with the typed name", async () => {
    mockCreateBranch.mockResolvedValue('Created and switched to a new line: "feature".');

    const { lastFrame, stdin } = render(<Branch />);
    await settle();

    expect(lastFrame()).toContain("Name for the new line:");
    await typeText(stdin, "feature");
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Created and switched to a new line: "feature".');
    });
    expect(mockCreateBranch).toHaveBeenCalledWith("feature");
  });

  it("ignores an empty submission and keeps prompting", async () => {
    const { lastFrame, stdin } = render(<Branch />);
    await settle();

    await pressKey(stdin, "\r");

    expect(mockCreateBranch).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("Name for the new line:");
  });
});
