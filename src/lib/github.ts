import path from "node:path";
import { getOctokit, isLoggedIn } from "./auth.js";
import { getRemoteUrl } from "./git.js";

export class GittoGitHubError extends Error {}

function requireOctokit() {
  if (!isLoggedIn()) {
    throw new GittoGitHubError("You're not connected to GitHub yet. Run `gitto login` first.");
  }
  return getOctokit();
}

export interface RepoRef {
  owner: string;
  repo: string;
}

function parseRemote(url: string): RepoRef | null {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+?)(\.git)?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export async function getCurrentRepoRef(cwd: string = process.cwd()): Promise<RepoRef> {
  const url = await getRemoteUrl(cwd);
  if (!url) {
    throw new GittoGitHubError("This project isn't connected to a GitHub repository yet.");
  }
  const ref = parseRemote(url);
  if (!ref) {
    throw new GittoGitHubError("This project's remote doesn't look like a GitHub repository.");
  }
  return ref;
}

function translateGitHubError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403) {
    return "GitHub didn't accept your credentials. Try `gitto login` again.";
  }
  if (status === 404) {
    return "GitHub couldn't find that — check the name and try again.";
  }
  if (status === 422) {
    const errors = (err as { response?: { data?: { errors?: Array<{ message?: string }> } } })
      ?.response?.data?.errors;
    if (errors?.some((e) => /already exists/i.test(e.message ?? ""))) {
      return "A repo with that name already exists on your GitHub account. Rename this folder, or rename the repo on GitHub, then try again.";
    }
    return "GitHub rejected that request — it may already exist or the details don't check out.";
  }
  return "Something went wrong talking to GitHub. Please try again.";
}

/** Turns the current folder's name into a name that's safe for GitHub's repo-naming rules. */
export function suggestRepoName(cwd: string = process.cwd()): string {
  const sanitized = path
    .basename(cwd)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "my-project";
}

export interface CreateRepoOptions {
  name: string;
  private?: boolean;
}

export interface CreatedRepo {
  url: string;
  htmlUrl: string;
}

export async function createRepo(options: CreateRepoOptions): Promise<CreatedRepo> {
  const octokit = requireOctokit();
  try {
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: options.name,
      private: options.private ?? false,
    });
    return { url: data.clone_url ?? data.html_url, htmlUrl: data.html_url };
  } catch (err) {
    throw new GittoGitHubError(translateGitHubError(err));
  }
}

export interface CreateRequestOptions {
  title: string;
  head: string;
  base: string;
  body?: string;
}

export async function createRequest(
  options: CreateRequestOptions,
  cwd: string = process.cwd()
): Promise<string> {
  const octokit = requireOctokit();
  const { owner, repo } = await getCurrentRepoRef(cwd);
  try {
    const { data } = await octokit.pulls.create({
      owner,
      repo,
      title: options.title,
      head: options.head,
      base: options.base,
      body: options.body,
    });
    return `Opened request #${data.number}: ${data.html_url}`;
  } catch (err) {
    throw new GittoGitHubError(translateGitHubError(err));
  }
}

export interface CreateIssueOptions {
  title: string;
  body?: string;
}

export async function createIssue(
  options: CreateIssueOptions,
  cwd: string = process.cwd()
): Promise<string> {
  const octokit = requireOctokit();
  const { owner, repo } = await getCurrentRepoRef(cwd);
  try {
    const { data } = await octokit.issues.create({
      owner,
      repo,
      title: options.title,
      body: options.body,
    });
    return `Opened issue #${data.number}: ${data.html_url}`;
  } catch (err) {
    throw new GittoGitHubError(translateGitHubError(err));
  }
}

export async function forkRepo(cwd: string = process.cwd()): Promise<string> {
  const octokit = requireOctokit();
  const { owner, repo } = await getCurrentRepoRef(cwd);
  try {
    const { data } = await octokit.repos.createFork({ owner, repo });
    return `Forked to ${data.full_name}: ${data.html_url}`;
  } catch (err) {
    throw new GittoGitHubError(translateGitHubError(err));
  }
}

export async function addCollaborator(
  username: string,
  cwd: string = process.cwd()
): Promise<string> {
  const octokit = requireOctokit();
  const { owner, repo } = await getCurrentRepoRef(cwd);
  try {
    await octokit.repos.addCollaborator({ owner, repo, username });
    return `Invited ${username} to collaborate on ${owner}/${repo}.`;
  } catch (err) {
    throw new GittoGitHubError(translateGitHubError(err));
  }
}
