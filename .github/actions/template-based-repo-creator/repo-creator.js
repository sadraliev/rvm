import * as github from "@actions/github";
import * as core from "@actions/core";

export async function run({
  token,
  templateOwner,
  templateRepo,
  newRepoOwner,
  newRepoName,
  isPrivate,
}) {
  const octokit = github.getOctokit(token);

  const response = await octokit.request(
    `POST /repos/${templateOwner}/${templateRepo}/generate`,
    {
      template_owner: templateOwner,
      template_repo: templateRepo,
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

export async function createTemplateBasedRepository({
  token,
  templateOwner,
  templateRepo,
  newRepoOwner,
  newRepoName,
  isPrivate,
}) {
  try {
    const { repository_url } = await run({
      token,
      templateOwner,
      templateRepo,
      newRepoOwner,
      newRepoName,
      isPrivate,
    });
    core.setOutput("repository_url", repository_url);

    console.log(`Repository created: ${repository_url}`);
  } catch (error) {
    core.setFailed(error.message);
    console.error(error);
  }
}
