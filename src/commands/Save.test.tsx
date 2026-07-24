import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";

const mockSave = vi.fn();
const mockGetInProgressOperation = vi.fn();
const mockGetSavePreflight = vi.fn();

vi.mock("../lib/git.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/git.js")>("../lib/git.js");
  return {
    ...actual,
    save: (...args: unknown[]) => mockSave(...args),
    getInProgressOperation: () => mockGetInProgressOperation(),
    getSavePreflight: (...args: unknown[]) => mockGetSavePreflight(...args),
  };
});

import { Save } from "./Save.js";

async function typeText(stdin: { write: (data: string) => void }, text: string): Promise<void> {
  for (const char of text) {
    stdin.write(char);
    // Let React commit this keystroke's state update before sending the next
    // one — writes fired back-to-back in the same tick get batched, so
    // ink-text-input's onChange closure sees a stale value and drops chars.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// Same reasoning as typeText: a key that unmounts one component and mounts
// another (e.g. Confirm answering into a Prompt) needs a tick for the new
// component's useInput listener to attach before the next key is sent.
async function pressKey(stdin: { write: (data: string) => void }, key: string): Promise<void> {
  stdin.write(key);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetInProgressOperation.mockResolvedValue(null);
});

describe("Save — happy path", () => {
  it("asks which files, then what changed, then saves everything", async () => {
    mockGetSavePreflight.mockResolvedValue({ hardBlocked: [], flagged: [], hasChanges: true });
    mockSave.mockResolvedValue("Saved 2 files.");

    const { lastFrame, stdin } = render(<Save />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Save everything, or just some files/folders?");
    });

    stdin.write("\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("What did you change?");
    });

    await typeText(stdin, "fix the bug");
    stdin.write("\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Saved 2 files.");
    });

    expect(mockGetSavePreflight).toHaveBeenCalledWith(undefined, []);
    expect(mockSave).toHaveBeenCalledWith("fix the bug", undefined, [], []);
  });

  it("scopes the save to the paths the user typed", async () => {
    mockGetSavePreflight.mockResolvedValue({ hardBlocked: [], flagged: [], hasChanges: true });
    mockSave.mockResolvedValue("Saved 1 file.");

    const { lastFrame, stdin } = render(<Save />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Save everything, or just some files/folders?");
    });

    await typeText(stdin, "src/lib");
    stdin.write("\r");

    await vi.waitFor(() => {
      expect(mockGetSavePreflight).toHaveBeenCalled();
    });
    expect(mockGetSavePreflight).toHaveBeenCalledWith(undefined, ["src/lib"]);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("What did you change?");
    });
    stdin.write("\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Saved 1 file.");
    });
    expect(mockSave).toHaveBeenCalledWith("Update", undefined, [], ["src/lib"]);
  });
});

describe("Save — sensitive files", () => {
  it("refuses to save hard-blocked files", async () => {
    mockGetSavePreflight.mockResolvedValue({
      hardBlocked: ["id_rsa"],
      flagged: [],
      hasChanges: true,
    });

    const { lastFrame, stdin } = render(<Save />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Save everything, or just some files/folders?");
    });
    stdin.write("\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("id_rsa");
    });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("offers to exclude flagged files, then saves the rest", async () => {
    mockGetSavePreflight.mockResolvedValue({
      hardBlocked: [],
      flagged: [".env"],
      hasChanges: true,
    });
    mockSave.mockResolvedValue("Saved 1 file.");

    const { lastFrame, stdin } = render(<Save />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Save everything, or just some files/folders?");
    });
    stdin.write("\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("These usually shouldn't be saved");
    });
    expect(lastFrame()).toContain(".env");

    await pressKey(stdin, "y");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("What did you change?");
    });
    stdin.write("\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Saved 1 file.");
    });
    expect(mockSave).toHaveBeenCalledWith("Update", undefined, [".env"], []);
  });

  it("lets the user save flagged files anyway after declining to exclude", async () => {
    mockGetSavePreflight.mockResolvedValue({
      hardBlocked: [],
      flagged: [".env"],
      hasChanges: true,
    });
    mockSave.mockResolvedValue("Saved 1 file.");

    const { lastFrame, stdin } = render(<Save />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Save everything, or just some files/folders?");
    });
    stdin.write("\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("These usually shouldn't be saved");
    });

    await pressKey(stdin, "n");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Are you sure you want to save them anyway?");
    });

    await pressKey(stdin, "y");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("What did you change?");
    });
    stdin.write("\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Saved 1 file.");
    });
    expect(mockSave).toHaveBeenCalledWith("Update", undefined, [], []);
  });
});

describe("Save — continuing an in-progress operation", () => {
  it("continues a rebase without asking which files to save", async () => {
    mockGetInProgressOperation.mockResolvedValue("rebase");
    mockSave.mockResolvedValue("Finished replaying all your changes.");

    const { lastFrame } = render(<Save />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Finished replaying all your changes.");
    });
    expect(mockGetSavePreflight).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith("");
  });

  it("asks for a merge message when finishing a merge", async () => {
    mockGetInProgressOperation.mockResolvedValue("merge");
    mockSave.mockResolvedValue("Finished combining.");

    const { lastFrame, stdin } = render(<Save />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("What did you change?");
    });

    stdin.write("\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Finished combining.");
    });
    expect(mockSave).toHaveBeenCalledWith("Merge", undefined, [], []);
  });
});
