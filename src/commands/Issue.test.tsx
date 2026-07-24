import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey, settle, typeText } from "../testSupport/ink.js";

const mockCreateIssue = vi.fn();
vi.mock("../lib/github.js", () => ({
  createIssue: (...args: unknown[]) => mockCreateIssue(...args),
}));

import { Issue } from "./Issue.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Issue", () => {
  it("opens an issue with the typed title", async () => {
    mockCreateIssue.mockResolvedValue("Opened issue #3: https://github.com/nayan/gitto/issues/3");

    const { lastFrame, stdin } = render(<Issue />);
    await settle();

    expect(lastFrame()).toContain("What's the issue?");
    await typeText(stdin, "found a bug");
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Opened issue #3");
    });
    expect(mockCreateIssue).toHaveBeenCalledWith({ title: "found a bug" });
  });
});
