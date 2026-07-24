import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey, settle, typeText } from "../testSupport/ink.js";

const mockListBranches = vi.fn();
vi.mock("../lib/git.js", () => ({
  listBranches: () => mockListBranches(),
}));

const mockCreateRequest = vi.fn();
vi.mock("../lib/github.js", () => ({
  createRequest: (...args: unknown[]) => mockCreateRequest(...args),
}));

import { Request } from "./Request.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Request", () => {
  it("says there's nothing to request against with only one branch", async () => {
    mockListBranches.mockResolvedValue({ current: "feature", others: [] });

    const { lastFrame } = render(<Request />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("nothing to request against");
    });
  });

  it("opens a request against the picked base branch with the typed title", async () => {
    mockListBranches.mockResolvedValue({ current: "feature", others: ["main"] });
    mockCreateRequest.mockResolvedValue("Opened request #7: https://github.com/nayan/gitto/pull/7");

    const { lastFrame, stdin } = render(<Request />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Request that "feature" be combined into which line?');
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Title for the request:");
    });
    await settle();
    await typeText(stdin, "add feature");
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Opened request #7");
    });
    expect(mockCreateRequest).toHaveBeenCalledWith({
      title: "add feature",
      head: "feature",
      base: "main",
    });
  });

  it("ignores an empty title", async () => {
    mockListBranches.mockResolvedValue({ current: "feature", others: ["main"] });

    const { lastFrame, stdin } = render(<Request />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Request that "feature" be combined into which line?');
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Title for the request:");
    });
    await settle();
    await pressKey(stdin, "\r");

    expect(mockCreateRequest).not.toHaveBeenCalled();
  });
});
