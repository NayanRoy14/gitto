import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";

const mockGetHistory = vi.fn();
vi.mock("../lib/git.js", () => ({
  getHistory: () => mockGetHistory(),
}));

import { History } from "./History.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("History", () => {
  it("lists saved changes", async () => {
    mockGetHistory.mockResolvedValue([
      { hash: "abc1234", message: "add thing", date: "2026-01-01T00:00:00Z", author: "nayan" },
    ]);

    const { lastFrame } = render(<History />);

    expect(lastFrame()).toContain("Looking up your history...");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("abc1234");
    });
    expect(lastFrame()).toContain("add thing");
  });

  it("says when nothing is saved yet", async () => {
    mockGetHistory.mockResolvedValue([]);

    const { lastFrame } = render(<History />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Nothing saved yet.");
    });
  });

  it("shows the error when loading history fails", async () => {
    mockGetHistory.mockRejectedValue(new Error("There's nothing saved yet."));

    const { lastFrame } = render(<History />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("There's nothing saved yet.");
    });
  });
});
