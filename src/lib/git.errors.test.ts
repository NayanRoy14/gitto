import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStatus = vi.fn();
const mockClone = vi.fn();

vi.mock("simple-git", async () => {
  const actual = await vi.importActual<typeof import("simple-git")>("simple-git");
  return {
    ...actual,
    simpleGit: () => ({
      status: mockStatus,
      clone: mockClone,
      env: function (this: unknown) {
        return this;
      },
    }),
  };
});

vi.mock("./config.js", () => ({
  getToken: () => undefined,
  getLogin: () => undefined,
}));

const { getStatus, download, GittoGitError } = await import("./git.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("network error translation", () => {
  it("translates a stalled connection (silence timeout) into a friendly message", async () => {
    mockStatus.mockRejectedValue(new Error("block timeout reached"));

    await expect(getStatus()).rejects.toThrow(
      "GitHub took too long to respond. Check your connection and try again.",
    );
  });

  it("wraps the timeout in GittoGitError like any other translated error", async () => {
    mockStatus.mockRejectedValue(new Error("block timeout reached"));

    await expect(getStatus()).rejects.toBeInstanceOf(GittoGitError);
  });

  it("translates a stalled download the same way", async () => {
    mockClone.mockRejectedValue(new Error("block timeout reached"));

    await expect(download("https://github.com/nayan/gitto.git")).rejects.toThrow(
      "GitHub took too long to respond. Check your connection and try again.",
    );
  });

  it("still translates a plain network-unreachable error as before", async () => {
    mockStatus.mockRejectedValue(new Error("could not resolve host: github.com"));

    await expect(getStatus()).rejects.toThrow(
      "Couldn't reach GitHub. Check your internet connection and try again.",
    );
  });
});
