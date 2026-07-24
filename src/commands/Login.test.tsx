import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";

const mockLogin = vi.fn();
vi.mock("../lib/auth.js", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

import { Login } from "./Login.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Login", () => {
  it("shows the device code and verification URL while waiting", async () => {
    let resolveLogin!: (value: { login: string }) => void;
    mockLogin.mockImplementation((onVerification: (v: unknown) => void) => {
      onVerification({ userCode: "ABCD-1234", verificationUri: "https://github.com/login/device" });
      return new Promise((resolve) => {
        resolveLogin = resolve;
      });
    });

    const { lastFrame } = render(<Login />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("https://github.com/login/device");
    });
    expect(lastFrame()).toContain("ABCD-1234");

    resolveLogin({ login: "nayan" });
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Logged in as nayan.");
    });
  });

  it("calls onComplete with success once logged in", async () => {
    mockLogin.mockImplementation(async (onVerification: (v: unknown) => void) => {
      onVerification({ userCode: "ABCD-1234", verificationUri: "https://github.com/login/device" });
      return { login: "nayan" };
    });
    const onComplete = vi.fn();

    render(<Login onComplete={onComplete} />);

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({ ok: true, message: "Logged in as nayan." });
    });
  });

  it("calls onComplete with failure when login fails", async () => {
    mockLogin.mockRejectedValue(new Error("Couldn't reach GitHub."));
    const onComplete = vi.fn();

    const { lastFrame } = render(<Login onComplete={onComplete} />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Couldn't reach GitHub.");
    });
    expect(onComplete).toHaveBeenCalledWith({ ok: false, message: "Couldn't reach GitHub." });
  });

  it("shows a connecting spinner before the device code arrives", () => {
    mockLogin.mockImplementation(() => new Promise(() => {}));

    const { lastFrame } = render(<Login />);

    expect(lastFrame()).toContain("Connecting to GitHub...");
  });
});
