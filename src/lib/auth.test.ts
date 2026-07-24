import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateOAuthDeviceAuth = vi.fn();
vi.mock("@octokit/auth-oauth-device", () => ({
  createOAuthDeviceAuth: (...args: unknown[]) => mockCreateOAuthDeviceAuth(...args),
}));

const mockGetAuthenticated = vi.fn();
const mockOctokitCtor = vi.fn();
vi.mock("@octokit/rest", () => ({
  Octokit: class {
    constructor(...args: unknown[]) {
      mockOctokitCtor(...args);
    }
    users = { getAuthenticated: mockGetAuthenticated };
  },
}));

const mockWriteConfig = vi.fn();
const mockGetToken = vi.fn();
vi.mock("./config.js", () => ({
  writeConfig: (...args: unknown[]) => mockWriteConfig(...args),
  getToken: () => mockGetToken(),
}));

import { login, isLoggedIn, getOctokit, NotAuthenticatedError } from "./auth.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("login", () => {
  it("notifies verification, fetches the authenticated user, and stores token+login", async () => {
    mockCreateOAuthDeviceAuth.mockImplementation(
      (opts: { onVerification: (v: unknown) => void }) => {
        return async () => {
          opts.onVerification({
            user_code: "ABCD-1234",
            verification_uri: "https://github.com/login/device",
          });
          return { token: "tok_123" };
        };
      },
    );
    mockGetAuthenticated.mockResolvedValue({ data: { login: "nayan" } });

    const onVerification = vi.fn();
    const result = await login(onVerification);

    expect(onVerification).toHaveBeenCalledWith({
      userCode: "ABCD-1234",
      verificationUri: "https://github.com/login/device",
    });
    expect(result).toEqual({ login: "nayan" });
    expect(mockWriteConfig).toHaveBeenCalledWith({ token: "tok_123", login: "nayan" });
  });

  it("requests the repo, read:user, and workflow scopes", async () => {
    mockCreateOAuthDeviceAuth.mockImplementation(() => async () => ({ token: "tok" }));
    mockGetAuthenticated.mockResolvedValue({ data: { login: "x" } });

    await login(() => {});

    expect(mockCreateOAuthDeviceAuth).toHaveBeenCalledWith(
      expect.objectContaining({ scopes: ["repo", "read:user", "workflow"] }),
    );
  });
});

describe("isLoggedIn", () => {
  it("is true when a token is stored", () => {
    mockGetToken.mockReturnValue("tok");
    expect(isLoggedIn()).toBe(true);
  });

  it("is false when no token is stored", () => {
    mockGetToken.mockReturnValue(undefined);
    expect(isLoggedIn()).toBe(false);
  });
});

describe("getOctokit", () => {
  it("throws NotAuthenticatedError when no token is stored", () => {
    mockGetToken.mockReturnValue(undefined);
    expect(() => getOctokit()).toThrow(NotAuthenticatedError);
  });

  it("builds an authenticated client when a token exists", () => {
    mockGetToken.mockReturnValue("tok_456");
    getOctokit();
    expect(mockOctokitCtor).toHaveBeenCalledWith(expect.objectContaining({ auth: "tok_456" }));
  });
});

describe("missing client id", () => {
  it("throws a clear error if GITTO_GITHUB_CLIENT_ID is explicitly set empty", async () => {
    const original = process.env.GITTO_GITHUB_CLIENT_ID;
    process.env.GITTO_GITHUB_CLIENT_ID = "";
    vi.resetModules();
    try {
      const freshAuth = await import("./auth.js");
      await expect(freshAuth.login(() => {})).rejects.toThrow(/Client ID/);
    } finally {
      if (original === undefined) {
        delete process.env.GITTO_GITHUB_CLIENT_ID;
      } else {
        process.env.GITTO_GITHUB_CLIENT_ID = original;
      }
      vi.resetModules();
    }
  });
});
