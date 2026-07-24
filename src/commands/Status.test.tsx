import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";

const mockGetStatus = vi.fn();
const mockFindTrackedSecrets = vi.fn();
vi.mock("../lib/git.js", () => ({
  getStatus: () => mockGetStatus(),
  findTrackedSecrets: () => mockFindTrackedSecrets(),
}));

import { Status } from "./Status.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Status", () => {
  it("shows a spinner while loading, then the status summary", async () => {
    mockGetStatus.mockResolvedValue({
      branch: "main",
      changedFiles: 2,
      readyToUpload: 0,
      upToDate: false,
      connectedToGitHub: true,
    });
    mockFindTrackedSecrets.mockResolvedValue([]);

    const { lastFrame } = render(<Status />);

    expect(lastFrame()).toContain("Checking status...");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('On "main"');
    });
    expect(lastFrame()).toContain("2 files changed and not yet saved");
  });

  it("mentions when the project isn't connected to GitHub", async () => {
    mockGetStatus.mockResolvedValue({
      branch: "main",
      changedFiles: 0,
      readyToUpload: 0,
      upToDate: true,
      connectedToGitHub: false,
    });
    mockFindTrackedSecrets.mockResolvedValue([]);

    const { lastFrame } = render(<Status />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("isn't connected to GitHub yet");
    });
  });

  it("warns about tracked secrets", async () => {
    mockGetStatus.mockResolvedValue({
      branch: "main",
      changedFiles: 0,
      readyToUpload: 0,
      upToDate: true,
      connectedToGitHub: true,
    });
    mockFindTrackedSecrets.mockResolvedValue([".env"]);

    const { lastFrame } = render(<Status />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("look like secrets");
    });
    expect(lastFrame()).toContain(".env");
  });

  it("surfaces errors from getStatus", async () => {
    mockGetStatus.mockRejectedValue(new Error("Couldn't reach GitHub."));
    mockFindTrackedSecrets.mockResolvedValue([]);

    const { lastFrame } = render(<Status />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Couldn't reach GitHub.");
    });
  });
});
