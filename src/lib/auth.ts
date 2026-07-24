import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device";
import { Octokit } from "@octokit/rest";
import { getToken, writeConfig } from "./config.js";

// gitto's own GitHub OAuth App (Device Flow enabled). Client IDs are public,
// non-secret values, so it's safe to ship this default — override via
// GITTO_GITHUB_CLIENT_ID if you want to use your own app instead.
const DEFAULT_CLIENT_ID = "Ov23liS0REKn4IEdD0bc";
const CLIENT_ID = process.env.GITTO_GITHUB_CLIENT_ID ?? DEFAULT_CLIENT_ID;

// Octokit logs deprecation notices and warnings straight to the console by
// default; gitto translates every GitHub error itself, so silence Octokit's
// own logging to keep raw API output from ever reaching the user. Deprecation
// notices specifically are logged by @octokit/request via `request.log`, a
// separate option from the top-level `log` used by Octokit's own internals —
// both need to be silenced.
const silentLog = { debug() {}, info() {}, warn() {}, error() {} };
const octokitSilenceOptions = { log: silentLog, request: { log: silentLog } };

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

export interface DeviceVerification {
  userCode: string;
  verificationUri: string;
}

export async function login(
  onVerification: (info: DeviceVerification) => void,
): Promise<{ login: string }> {
  if (!CLIENT_ID) {
    throw new Error(
      "gitto isn't configured with a GitHub Client ID yet (set GITTO_GITHUB_CLIENT_ID).",
    );
  }

  const auth = createOAuthDeviceAuth({
    clientType: "oauth-app",
    clientId: CLIENT_ID,
    // "workflow" is required to push changes to .github/workflows/*; without it
    // GitHub silently rejects any push that touches a workflow file.
    scopes: ["repo", "read:user", "workflow"],
    onVerification(verification) {
      onVerification({
        userCode: verification.user_code,
        verificationUri: verification.verification_uri,
      });
    },
  });

  const { token } = await auth({ type: "oauth" });
  const octokit = new Octokit({ auth: token, ...octokitSilenceOptions });
  const { data: user } = await octokit.users.getAuthenticated();

  writeConfig({ token, login: user.login });
  return { login: user.login };
}

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}

export function getOctokit(): Octokit {
  const token = getToken();
  if (!token) throw new NotAuthenticatedError();
  return new Octokit({ auth: token, ...octokitSilenceOptions });
}
