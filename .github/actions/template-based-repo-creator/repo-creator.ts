import { getOctokit } from "@actions/github";
import * as core from "@actions/core";

export interface CreateRepoParams {
  token: string;
  templateOwner: string;
  templateRepo: string;
  newRepoOwner: string;
  newRepoName: string;
  isPrivate: boolean;
}

export type CreateRepoResult = {
  repository_url: string;
  default_branch_name: string;
};

export async function run(params: CreateRepoParams): Promise<CreateRepoResult> {
  const {
    token,
    templateOwner,
    templateRepo,
    newRepoOwner,
    newRepoName,
    isPrivate,
  } = params;

  const response = await getOctokit(token).request(
    `POST /repos/${templateOwner}/${templateRepo}/generate`,
    {
      owner: newRepoOwner,
      name: newRepoName,
      private: isPrivate,
      description: `Repository created from template ${templateOwner}/${templateRepo}`,
      headers: {
        accept: "application/vnd.github.baptiste-preview+json",
      },
    }
  );

  return {
    repository_url: response.data.html_url,
    default_branch_name: response.data.default_branch,
  };
}

export async function createTemplateBasedRepository(
  params: CreateRepoParams
): Promise<CreateRepoResult> {
  try {
    const { repository_url, default_branch_name } = await run(params);
    core.setOutput("repository_url", repository_url);
    core.setOutput("default_branch_name", default_branch_name);
    console.log(`Repository created: ${repository_url}`);
    return { repository_url, default_branch_name };
  } catch (error) {
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    } else {
      message = String(error);
    }
    core.setFailed(message);
    console.error(error);
    return { repository_url: "", default_branch_name: "" };
  }
}

export type ProtectDefaultBranchParams = {
  branch: string;
  owner: string;
  repo: string;
  token: string;
};

async function checkBranchExists(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<boolean> {
  try {
    await getOctokit(token).request(
      `GET /repos/${owner}/${repo}/branches/${branch}`,
      {
        headers: {
          accept: "application/vnd.github+json",
        },
      }
    );
    return true;
  } catch (error: any) {
    if (error?.status === 404) {
      return false;
    }
    throw error;
  }
}

export async function protectDefaultBranch({
  branch,
  owner,
  repo,
  token,
}: ProtectDefaultBranchParams): Promise<void> {
  console.log(`Protecting branch ${branch}...`);

  // Check if branch exists first
  const branchExists = await checkBranchExists(owner, repo, branch, token);
  if (!branchExists) {
    throw new Error(
      `Branch ${branch} does not exist yet. It may still be initializing from the template.`
    );
  }

  await getOctokit(token).request(
    `PUT /repos/${owner}/${repo}/branches/${branch}/protection`,
    {
      required_status_checks: {
        strict: true,
        contexts: [],
      },
      enforce_admins: true,
      required_pull_request_reviews: {
        required_approving_review_count: 1,
      },
      restrictions: null,
      headers: {
        accept: "application/vnd.github+json",
      },
    }
  );

  console.log(`Branch ${branch} is now protected.`);
}
