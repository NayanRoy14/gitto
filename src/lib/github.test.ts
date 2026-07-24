import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsLoggedIn = vi.fn();
const mockGetOctokit = vi.fn();
vi.mock("./auth.js", () => ({
  isLoggedIn: () => mockIsLoggedIn(),
  getOctokit: () => mockGetOctokit(),
}));

const mockGetRemoteUrl = vi.fn();
vi.mock("./git.js", () => ({
  getRemoteUrl: (...args: unknown[]) => mockGetRemoteUrl(...args),
}));

import {
  suggestRepoName,
  getCurrentRepoRef,
  createRepo,
  createRequest,
  createIssue,
  forkRepo,
  addCollaborator,
  GittoGitHubError,
} from "./github.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLoggedIn.mockReturnValue(true);
});

describe("suggestRepoName", () => {
  it("uses the folder name as-is when it's already valid", () => {
    expect(suggestRepoName("/home/user/my-project")).toBe("my-project");
  });

  it("replaces invalid characters with dashes", () => {
    expect(suggestRepoName("/home/user/my cool project!")).toBe("my-cool-project");
  });

  it("strips leading and trailing dashes", () => {
    expect(suggestRepoName("/home/user/---weird---")).toBe("weird");
  });

  it("falls back to my-project when nothing valid remains", () => {
    expect(suggestRepoName("/home/user/!!!")).toBe("my-project");
  });
});

describe("getCurrentRepoRef", () => {
  it("throws when there's no remote", async () => {
    mockGetRemoteUrl.mockResolvedValue(null);
    await expect(getCurrentRepoRef()).rejects.toThrow(/isn't connected to a GitHub repository/);
  });

  it("throws when the remote isn't a GitHub URL", async () => {
    mockGetRemoteUrl.mockResolvedValue("https://gitlab.com/owner/repo.git");
    await expect(getCurrentRepoRef()).rejects.toThrow(/doesn't look like a GitHub repository/);
  });

  it("parses an https remote with a .git suffix", async () => {
    mockGetRemoteUrl.mockResolvedValue("https://github.com/nayanroy14/gitto.git");
    await expect(getCurrentRepoRef()).resolves.toEqual({ owner: "nayanroy14", repo: "gitto" });
  });

  it("parses an https remote without a .git suffix", async () => {
    mockGetRemoteUrl.mockResolvedValue("https://github.com/nayanroy14/gitto");
    await expect(getCurrentRepoRef()).resolves.toEqual({ owner: "nayanroy14", repo: "gitto" });
  });

  it("parses an ssh-style remote", async () => {
    mockGetRemoteUrl.mockResolvedValue("git@github.com:nayanroy14/gitto.git");
    await expect(getCurrentRepoRef()).resolves.toEqual({ owner: "nayanroy14", repo: "gitto" });
  });
});

describe("createRepo", () => {
  it("requires login before calling GitHub", async () => {
    mockIsLoggedIn.mockReturnValue(false);
    await expect(createRepo({ name: "x" })).rejects.toThrow(/Run `gitto login` first/);
    expect(mockGetOctokit).not.toHaveBeenCalled();
  });

  it("creates the repo and returns clone/html urls", async () => {
    const createForAuthenticatedUser = vi.fn().mockResolvedValue({
      data: { clone_url: "https://github.com/nayan/x.git", html_url: "https://github.com/nayan/x" },
    });
    mockGetOctokit.mockReturnValue({ repos: { createForAuthenticatedUser } });

    const result = await createRepo({ name: "x", private: true });

    expect(createForAuthenticatedUser).toHaveBeenCalledWith({ name: "x", private: true });
    expect(result).toEqual({
      url: "https://github.com/nayan/x.git",
      htmlUrl: "https://github.com/nayan/x",
    });
  });

  it.each([
    [401, /didn't accept your credentials/],
    [403, /didn't accept your credentials/],
    [404, /couldn't find that/],
  ])("translates a %d error", async (status, expected) => {
    mockGetOctokit.mockReturnValue({
      repos: {
        createForAuthenticatedUser: vi.fn().mockRejectedValue({ status }),
      },
    });
    await expect(createRepo({ name: "x" })).rejects.toThrow(expected);
  });

  it("translates a 422 'already exists' error with a specific message", async () => {
    mockGetOctokit.mockReturnValue({
      repos: {
        createForAuthenticatedUser: vi.fn().mockRejectedValue({
          status: 422,
          response: { data: { errors: [{ message: "name already exists on this account" }] } },
        }),
      },
    });
    await expect(createRepo({ name: "x" })).rejects.toThrow(
      /already exists on your GitHub account/,
    );
  });

  it("translates a generic 422 error", async () => {
    mockGetOctokit.mockReturnValue({
      repos: { createForAuthenticatedUser: vi.fn().mockRejectedValue({ status: 422 }) },
    });
    await expect(createRepo({ name: "x" })).rejects.toThrow(/GitHub rejected that request/);
  });

  it("falls back to a generic message for unrecognized errors", async () => {
    mockGetOctokit.mockReturnValue({
      repos: { createForAuthenticatedUser: vi.fn().mockRejectedValue(new Error("boom")) },
    });
    await expect(createRepo({ name: "x" })).rejects.toThrow(
      /Something went wrong talking to GitHub/,
    );
  });

  it("wraps failures in GittoGitHubError", async () => {
    mockGetOctokit.mockReturnValue({
      repos: { createForAuthenticatedUser: vi.fn().mockRejectedValue({ status: 404 }) },
    });
    await expect(createRepo({ name: "x" })).rejects.toBeInstanceOf(GittoGitHubError);
  });

  it("distinguishes a primary rate limit (403 + x-ratelimit-remaining: 0) from a credentials error", async () => {
    mockGetOctokit.mockReturnValue({
      repos: {
        createForAuthenticatedUser: vi.fn().mockRejectedValue({
          status: 403,
          response: { headers: { "x-ratelimit-remaining": "0" } },
        }),
      },
    });
    await expect(createRepo({ name: "x" })).rejects.toThrow(/rate-limiting requests/);
  });

  it("includes the retry-after duration for a secondary/abuse rate limit", async () => {
    mockGetOctokit.mockReturnValue({
      repos: {
        createForAuthenticatedUser: vi.fn().mockRejectedValue({
          status: 403,
          response: { headers: { "retry-after": "42" } },
        }),
      },
    });
    await expect(createRepo({ name: "x" })).rejects.toThrow(/Try again in about 42 seconds/);
  });

  it("recognizes a 429 rate-limit response", async () => {
    mockGetOctokit.mockReturnValue({
      repos: {
        createForAuthenticatedUser: vi.fn().mockRejectedValue({
          status: 429,
          message: "You have exceeded a secondary rate limit",
        }),
      },
    });
    await expect(createRepo({ name: "x" })).rejects.toThrow(/rate-limiting requests/);
  });

  it("still treats a plain 403 with no rate-limit signal as a credentials error", async () => {
    mockGetOctokit.mockReturnValue({
      repos: { createForAuthenticatedUser: vi.fn().mockRejectedValue({ status: 403 }) },
    });
    await expect(createRepo({ name: "x" })).rejects.toThrow(/didn't accept your credentials/);
  });
});

describe("createRequest", () => {
  it("opens a pull request against the current repo", async () => {
    mockGetRemoteUrl.mockResolvedValue("https://github.com/nayan/gitto.git");
    const create = vi.fn().mockResolvedValue({
      data: { number: 7, html_url: "https://github.com/nayan/gitto/pull/7" },
    });
    mockGetOctokit.mockReturnValue({ pulls: { create } });

    const result = await createRequest({ title: "t", head: "feature", base: "main" });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "nayan",
        repo: "gitto",
        title: "t",
        head: "feature",
        base: "main",
      }),
    );
    expect(result).toBe("Opened request #7: https://github.com/nayan/gitto/pull/7");
  });
});

describe("createIssue", () => {
  it("opens an issue against the current repo", async () => {
    mockGetRemoteUrl.mockResolvedValue("https://github.com/nayan/gitto.git");
    const create = vi.fn().mockResolvedValue({
      data: { number: 3, html_url: "https://github.com/nayan/gitto/issues/3" },
    });
    mockGetOctokit.mockReturnValue({ issues: { create } });

    const result = await createIssue({ title: "bug" });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "nayan", repo: "gitto", title: "bug" }),
    );
    expect(result).toBe("Opened issue #3: https://github.com/nayan/gitto/issues/3");
  });
});

describe("forkRepo", () => {
  it("forks the current repo", async () => {
    mockGetRemoteUrl.mockResolvedValue("https://github.com/nayan/gitto.git");
    const createFork = vi.fn().mockResolvedValue({
      data: { full_name: "me/gitto", html_url: "https://github.com/me/gitto" },
    });
    mockGetOctokit.mockReturnValue({ repos: { createFork } });

    const result = await forkRepo();

    expect(createFork).toHaveBeenCalledWith({ owner: "nayan", repo: "gitto" });
    expect(result).toBe("Forked to me/gitto: https://github.com/me/gitto");
  });
});

describe("addCollaborator", () => {
  it("invites a collaborator to the current repo", async () => {
    mockGetRemoteUrl.mockResolvedValue("https://github.com/nayan/gitto.git");
    const addCollaboratorCall = vi.fn().mockResolvedValue({});
    mockGetOctokit.mockReturnValue({ repos: { addCollaborator: addCollaboratorCall } });

    const result = await addCollaborator("friend");

    expect(addCollaboratorCall).toHaveBeenCalledWith({
      owner: "nayan",
      repo: "gitto",
      username: "friend",
    });
    expect(result).toBe("Invited friend to collaborate on nayan/gitto.");
  });
});
