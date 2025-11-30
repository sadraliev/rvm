import * as core from "@actions/core";
import {
  createTemplateBasedRepository,
  protectDefaultBranch,
} from "./repo-creator.js";
import retrySystem from "./retry.js";

async function main(): Promise<void> {
  const token = core.getInput("token", { required: true });
  const templateOwner = core.getInput("template_owner", { required: true });
  const templateRepo = core.getInput("template_repo", { required: true });
  const newRepoOwner = core.getInput("new_repo_owner", { required: true });
  const newRepoName = core.getInput("new_repo_name", { required: true });
  const isPrivate = core.getInput("private") === "true";
  const shouldProtectDefaultBranch =
    core.getInput("protect_default_branch") === "true";

  const { default_branch_name } = await createTemplateBasedRepository({
    token,
    templateOwner,
    templateRepo,
    newRepoOwner,
    newRepoName,
    isPrivate,
  });
  if (shouldProtectDefaultBranch) {
    await retrySystem.execute(async () => {
      return protectDefaultBranch({
        token,
        owner: newRepoOwner,
        repo: newRepoName,
        branch: default_branch_name,
      });
    });
  }
}

main();
