import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey, settle, typeText } from "../testSupport/ink.js";

const mockDownload = vi.fn();
vi.mock("../lib/git.js", () => ({
  download: (...args: unknown[]) => mockDownload(...args),
}));

import { DownloadFlow } from "./DownloadFlow.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DownloadFlow", () => {
  it("asks for a URL, then downloads it", async () => {
    mockDownload.mockResolvedValue({ path: "./gitto" });

    const { lastFrame, stdin } = render(<DownloadFlow />);
    await settle();

    expect(lastFrame()).toContain("What's the GitHub URL to copy?");
    await typeText(stdin, "https://github.com/nayan/gitto.git");
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Downloaded into ./gitto.");
    });
    expect(mockDownload).toHaveBeenCalledWith("https://github.com/nayan/gitto.git", undefined);
  });

  it("ignores an empty URL", async () => {
    const { lastFrame, stdin } = render(<DownloadFlow />);
    await settle();
    await pressKey(stdin, "\r");

    expect(lastFrame()).toContain("What's the GitHub URL to copy?");
    expect(mockDownload).not.toHaveBeenCalled();
  });
});
