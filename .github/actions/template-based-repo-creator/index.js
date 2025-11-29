import * as core from "@actions/core";
import { createTemplateBasedRepository } from "./repo-creator.js";

async function main() {
  const token = core.getInput("token", { required: true });
  const templateOwner = core.getInput("template_owner", { required: true });
  const templateRepo = core.getInput("template_repo", { required: true });
  const newRepoOwner = core.getInput("new_repo_owner", { required: true });
  const newRepoName = core.getInput("new_repo_name", { required: true });
  const isPrivate = core.getInput("private") === "true";

  await createTemplateBasedRepository({
    token,
    templateOwner,
    templateRepo,
    newRepoOwner,
    newRepoName,
    isPrivate,
  });
}

main();
