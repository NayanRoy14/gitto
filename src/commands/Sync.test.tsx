import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";

const mockSync = vi.fn();
vi.mock("../lib/git.js", () => ({
  sync: () => mockSync(),
}));

import { Sync } from "./Sync.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Sync", () => {
  it("shows the result once sync resolves", async () => {
    mockSync.mockResolvedValue("Brought down 3 changed files.");

    const { lastFrame } = render(<Sync />);

    expect(lastFrame()).toContain("Bringing down the latest changes...");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Brought down 3 changed files.");
    });
  });

  it("shows the error when sync fails", async () => {
    mockSync.mockRejectedValue(new Error("Couldn't reach GitHub."));

    const { lastFrame } = render(<Sync />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Couldn't reach GitHub.");
    });
  });
});
