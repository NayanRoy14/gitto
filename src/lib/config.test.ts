import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("config", () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "gitto-config-"));
    vi.resetModules();
    vi.doMock("node:os", async (importOriginal) => {
      const actual = await importOriginal<typeof os>();
      return { ...actual, default: { ...actual, homedir: () => tmpHome }, homedir: () => tmpHome };
    });
  });

  afterEach(() => {
    vi.doUnmock("node:os");
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it("reports no config before anything is written", async () => {
    const config = await import("./config.js");
    expect(config.configExists()).toBe(false);
    expect(config.readConfig()).toEqual({});
    expect(config.getToken()).toBeUndefined();
    expect(config.getLogin()).toBeUndefined();
  });

  it("writes and reads back token/login, creating ~/.gitto on demand", async () => {
    const config = await import("./config.js");
    config.writeConfig({ token: "abc123", login: "nayan" });

    expect(config.configExists()).toBe(true);
    expect(config.getToken()).toBe("abc123");
    expect(config.getLogin()).toBe("nayan");
    expect(fs.existsSync(path.join(tmpHome, ".gitto", "config.json"))).toBe(true);
  });

  it("merges partial updates instead of overwriting the whole file", async () => {
    const config = await import("./config.js");
    config.writeConfig({ token: "abc123", login: "nayan" });
    config.writeConfig({ token: "def456" });

    expect(config.getToken()).toBe("def456");
    expect(config.getLogin()).toBe("nayan");
  });

  it("clearConfig removes the file", async () => {
    const config = await import("./config.js");
    config.writeConfig({ token: "abc123" });
    expect(config.configExists()).toBe(true);

    config.clearConfig();
    expect(config.configExists()).toBe(false);
    expect(config.getToken()).toBeUndefined();
  });

  it("clearConfig is a no-op when nothing was ever written", async () => {
    const config = await import("./config.js");
    expect(() => config.clearConfig()).not.toThrow();
  });

  it("readConfig recovers gracefully from a corrupted config file", async () => {
    const config = await import("./config.js");
    fs.mkdirSync(path.join(tmpHome, ".gitto"), { recursive: true });
    fs.writeFileSync(path.join(tmpHome, ".gitto", "config.json"), "{not valid json", "utf8");

    expect(config.readConfig()).toEqual({});
    expect(config.getToken()).toBeUndefined();
  });
});
