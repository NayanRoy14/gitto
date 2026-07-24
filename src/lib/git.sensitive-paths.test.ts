import { describe, it, expect } from "vitest";
import { isHardBlocked, isSoftExcluded, isSensitivePath } from "./git.js";

describe("isHardBlocked", () => {
  it.each([
    "id_rsa",
    "id_rsa.pub",
    "some/dir/id_rsa",
    "server.pem",
    "cert.key",
    "client.p12",
    "credentials.json",
    "nested/credentials.json",
    "secret.json",
    "secrets.yaml",
    "secrets.yml",
  ])("blocks %s", (file) => {
    expect(isHardBlocked(file)).toBe(true);
  });

  it.each(["README.md", "src/index.ts", "package.json", "keys.txt", "notasecret.json"])(
    "does not block %s",
    (file) => {
      expect(isHardBlocked(file)).toBe(false);
    },
  );
});

describe("isSoftExcluded", () => {
  it.each([
    "node_modules/foo/index.js",
    "some/node_modules/pkg/file.ts",
    ".env",
    ".env.local",
    ".env.production",
  ])("flags %s", (file) => {
    expect(isSoftExcluded(file)).toBe(true);
  });

  it("does not flag .env.example", () => {
    expect(isSoftExcluded(".env.example")).toBe(false);
  });

  it.each(["README.md", "src/index.ts", "environment.ts"])("does not flag %s", (file) => {
    expect(isSoftExcluded(file)).toBe(false);
  });
});

describe("isSensitivePath", () => {
  it("is true for hard-blocked files", () => {
    expect(isSensitivePath("id_rsa")).toBe(true);
  });

  it("is true for soft-excluded files", () => {
    expect(isSensitivePath(".env")).toBe(true);
  });

  it("is false for ordinary files", () => {
    expect(isSensitivePath("src/lib/git.ts")).toBe(false);
  });
});
