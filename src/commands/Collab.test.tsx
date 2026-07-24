import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey, settle, typeText } from "../testSupport/ink.js";

const mockAddCollaborator = vi.fn();
vi.mock("../lib/github.js", () => ({
  addCollaborator: (...args: unknown[]) => mockAddCollaborator(...args),
}));

import { Collab } from "./Collab.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Collab", () => {
  it("invites the typed username", async () => {
    mockAddCollaborator.mockResolvedValue("Invited friend to collaborate on nayan/gitto.");

    const { lastFrame, stdin } = render(<Collab />);
    await settle();

    expect(lastFrame()).toContain("Who should be invited?");
    await typeText(stdin, "friend");
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Invited friend to collaborate on nayan/gitto.");
    });
    expect(mockAddCollaborator).toHaveBeenCalledWith("friend");
  });
});
