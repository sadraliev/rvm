import * as core from "@actions/core";
import { getOctokit } from "@actions/github";

async function deleteRepository(
  token: string,
  owner: string,
  repo: string
): Promise<boolean> {
  const octokit = getOctokit(token);

  try {
    // First check if repository exists
    try {
      await octokit.rest.repos.get({ owner, repo });
    } catch (error: any) {
      if (error?.status === 404) {
        console.log(`Repository ${owner}/${repo} does not exist, skipping deletion.`);
        core.setOutput("deleted", "false");
        return false;
      }
      throw error;
    }

    // Delete the repository
    await octokit.rest.repos.delete({ owner, repo });
    console.log(`✅ Repository ${owner}/${repo} deleted successfully.`);
    core.setOutput("deleted", "true");
    return true;
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    
    // Handle common errors gracefully
    if (error?.status === 403) {
      core.setFailed(`Permission denied: Cannot delete ${owner}/${repo}. Check token permissions.`);
    } else if (error?.status === 404) {
      console.log(`Repository ${owner}/${repo} not found, may have already been deleted.`);
      core.setOutput("deleted", "false");
      return false;
    } else {
      core.setFailed(`Failed to delete repository: ${message}`);
    }
    
    throw error;
  }
}

async function main(): Promise<void> {
  const token = core.getInput("token", { required: true });
  const owner = core.getInput("owner", { required: true });
  const repo = core.getInput("repo", { required: true });

  console.log(`🗑️ Attempting to delete repository: ${owner}/${repo}`);
  
  await deleteRepository(token, owner, repo);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
  process.exit(1);
});

