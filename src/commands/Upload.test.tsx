import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey, settle } from "../testSupport/ink.js";

const mockGetRemoteUrl = vi.fn();
const mockAddRemote = vi.fn();
const mockUpload = vi.fn();
vi.mock("../lib/git.js", () => ({
  getRemoteUrl: () => mockGetRemoteUrl(),
  addRemote: (...args: unknown[]) => mockAddRemote(...args),
  upload: () => mockUpload(),
}));

const mockCreateRepo = vi.fn();
const mockSuggestRepoName = vi.fn();
vi.mock("../lib/github.js", () => ({
  createRepo: (...args: unknown[]) => mockCreateRepo(...args),
  suggestRepoName: () => mockSuggestRepoName(),
}));

import { Upload } from "./Upload.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockSuggestRepoName.mockReturnValue("my-project");
});

describe("Upload", () => {
  it("uploads directly when already connected to GitHub", async () => {
    mockGetRemoteUrl.mockResolvedValue("https://github.com/nayan/gitto.git");
    mockUpload.mockResolvedValue({ pushed: true, message: "Uploaded to GitHub." });

    const { lastFrame } = render(<Upload />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Uploaded to GitHub.");
    });
    expect(mockCreateRepo).not.toHaveBeenCalled();
  });

  it("creates a private repo by default when not yet connected", async () => {
    mockGetRemoteUrl.mockResolvedValue(null);
    mockCreateRepo.mockResolvedValue({
      url: "https://github.com/nayan/my-project.git",
      htmlUrl: "x",
    });
    mockUpload.mockResolvedValue({ pushed: true, message: "Uploaded to GitHub." });

    const { lastFrame, stdin } = render(<Upload />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Create "my-project" as a private repo?');
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Uploaded to GitHub.");
    });
    expect(mockCreateRepo).toHaveBeenCalledWith({ name: "my-project", private: true });
    expect(mockAddRemote).toHaveBeenCalledWith("https://github.com/nayan/my-project.git");
  });

  it("creates a public repo when the user declines private", async () => {
    mockGetRemoteUrl.mockResolvedValue(null);
    mockCreateRepo.mockResolvedValue({
      url: "https://github.com/nayan/my-project.git",
      htmlUrl: "x",
    });
    mockUpload.mockResolvedValue({ pushed: true, message: "Uploaded to GitHub." });

    const { lastFrame, stdin } = render(<Upload />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Create "my-project" as a private repo?');
    });
    await settle();
    await pressKey(stdin, "n");

    await vi.waitFor(() => {
      expect(mockCreateRepo).toHaveBeenCalledWith({ name: "my-project", private: false });
    });
  });

  it("shows an error when repo creation fails", async () => {
    mockGetRemoteUrl.mockResolvedValue(null);
    mockCreateRepo.mockRejectedValue(new Error("A repo with that name already exists"));

    const { lastFrame, stdin } = render(<Upload />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Create "my-project" as a private repo?');
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("A repo with that name already exists");
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
