import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey, settle } from "../testSupport/ink.js";

const mockIsLoggedIn = vi.fn();
vi.mock("../lib/auth.js", () => ({
  isLoggedIn: () => mockIsLoggedIn(),
}));

const mockClearConfig = vi.fn();
vi.mock("../lib/config.js", () => ({
  clearConfig: () => mockClearConfig(),
}));

import { Logout } from "./Logout.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Logout", () => {
  it("says when not logged in, without asking to confirm", () => {
    mockIsLoggedIn.mockReturnValue(false);

    const { lastFrame } = render(<Logout />);

    expect(lastFrame()).toContain("You're not logged in.");
    expect(mockClearConfig).not.toHaveBeenCalled();
  });

  it("logs out after confirmation", async () => {
    mockIsLoggedIn.mockReturnValue(true);

    const { lastFrame, stdin } = render(<Logout />);
    await settle();

    expect(lastFrame()).toContain("Disconnect your GitHub account?");
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Logged out.");
    });
    expect(mockClearConfig).toHaveBeenCalled();
  });

  it("does nothing when the user declines", async () => {
    mockIsLoggedIn.mockReturnValue(true);

    const { stdin } = render(<Logout />);
    await settle();
    await pressKey(stdin, "n");

    expect(mockClearConfig).not.toHaveBeenCalled();
  });
});
