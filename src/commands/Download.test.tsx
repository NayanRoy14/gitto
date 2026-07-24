import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";

const mockDownload = vi.fn();
vi.mock("../lib/git.js", () => ({
  download: (...args: unknown[]) => mockDownload(...args),
}));

import { Download } from "./Download.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Download", () => {
  it("reports where the project was downloaded", async () => {
    mockDownload.mockResolvedValue({ path: "./gitto" });

    const { lastFrame } = render(<Download url="https://github.com/nayan/gitto.git" />);

    expect(lastFrame()).toContain("Downloading https://github.com/nayan/gitto.git...");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Downloaded into ./gitto.");
    });
    expect(mockDownload).toHaveBeenCalledWith("https://github.com/nayan/gitto.git", undefined);
  });

  it("passes through a destination when given", async () => {
    mockDownload.mockResolvedValue({ path: "./somewhere" });

    render(<Download url="https://github.com/nayan/gitto.git" destination="./somewhere" />);

    await vi.waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith(
        "https://github.com/nayan/gitto.git",
        "./somewhere",
      );
    });
  });

  it("shows the error when download fails", async () => {
    mockDownload.mockRejectedValue(new Error("Couldn't reach GitHub."));

    const { lastFrame } = render(<Download url="https://github.com/nayan/gitto.git" />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Couldn't reach GitHub.");
    });
  });
});
