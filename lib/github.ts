const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER!;
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME!;

function headers() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export interface GitHubRepo {
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  visibility: string;
  language: string | null;
  pushed_at: string;
  open_issues_count: number;
}

export async function getRepo(): Promise<GitHubRepo> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

export async function getBranches(): Promise<GitHubBranch[]> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/branches?per_page=100`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export interface GitHubTag {
  name: string;
  commit: { sha: string };
}

export async function getTags(): Promise<GitHubTag[]> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/tags?per_page=100`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export async function deleteBranch(branchName: string): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/git/refs/heads/${branchName}`,
    { method: 'DELETE', headers: headers() }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `GitHub API error: ${res.status}`);
  }
}

export async function createBranch(branchName: string, sha: string): Promise<void> {
  // Fetch the tag's commit to get its tree SHA
  const commitRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/git/commits/${sha}`,
    { headers: headers() }
  );
  if (!commitRes.ok) throw new Error(`GitHub API error: ${commitRes.status}`);
  const { tree } = await commitRes.json();

  // Create a new commit with a custom message, same tree, parent = tag commit
  const newCommitRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/git/commits`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        message: 'Auto generated from demo creator',
        tree: tree.sha,
        parents: [sha],
      }),
    }
  );
  if (!newCommitRes.ok) {
    const err = await newCommitRes.json().catch(() => ({}));
    throw new Error(err.message ?? `GitHub API error: ${newCommitRes.status}`);
  }
  const { sha: newSha } = await newCommitRes.json();

  // Create the branch pointing at the new commit
  const refRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/git/refs`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: newSha }),
    }
  );
  if (!refRes.ok) {
    const err = await refRes.json().catch(() => ({}));
    throw new Error(err.message ?? `GitHub API error: ${refRes.status}`);
  }
}
