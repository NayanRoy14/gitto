import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";

const mockForkRepo = vi.fn();
vi.mock("../lib/github.js", () => ({
  forkRepo: () => mockForkRepo(),
}));

import { Fork } from "./Fork.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Fork", () => {
  it("shows the result once forking resolves", async () => {
    mockForkRepo.mockResolvedValue("Forked to me/gitto: https://github.com/me/gitto");

    const { lastFrame } = render(<Fork />);

    expect(lastFrame()).toContain("Forking this project...");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Forked to me/gitto");
    });
  });

  it("shows the error when forking fails", async () => {
    mockForkRepo.mockRejectedValue(new Error("GitHub couldn't find that."));

    const { lastFrame } = render(<Fork />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("GitHub couldn't find that.");
    });
  });
});
