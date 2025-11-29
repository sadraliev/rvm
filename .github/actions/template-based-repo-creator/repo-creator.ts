import * as github from "@actions/github";
import * as core from "@actions/core";

export interface CreateRepoParams {
  token: string;
  templateOwner: string;
  templateRepo: string;
  newRepoOwner: string;
  newRepoName: string;
  isPrivate: boolean;
}

export interface CreateRepoResult {
  repository_url: string;
}

export async function run(params: CreateRepoParams): Promise<CreateRepoResult> {
  const {
    token,
    templateOwner,
    templateRepo,
    newRepoOwner,
    newRepoName,
    isPrivate,
  } = params;

  const octokit = github.getOctokit(token);

  const response = await octokit.request(
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

  const repoUrl = response.data.html_url;

  return {
    repository_url: repoUrl,
  };
}

export async function createTemplateBasedRepository(
  params: CreateRepoParams
): Promise<void> {
  try {
    const { repository_url } = await run(params);
    core.setOutput("repository_url", repository_url);

    console.log(`Repository created: ${repository_url}`);
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
  }
}
