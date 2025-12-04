import * as core from "@actions/core";
import { getOctokit, context } from "@actions/github";

type CommentType =
  | "success"
  | "failure"
  | "deleted"
  | "no-repo"
  | "repo-exists";

interface CommentParams {
  repoName: string;
  repoUrl: string;
  template: string;
  collaborators: string[];
}

// ============================================
// Comment Generation
// ============================================

function generateComment(type: CommentType, params: CommentParams): string {
  const { repoName, repoUrl, template, collaborators } = params;
  const accountsList = collaborators.map((a) => `- @${a}`).join("\n");

  switch (type) {
    case "success":
      return `## ✅ Repository Created Successfully!

**Repository:** [${repoName}](${repoUrl})
**Template:** \`${template}\`

**Collaborators Added:**
${accountsList || "_No collaborators specified_"}

---

⚠️ **Important:** Closing this issue will **delete** the repository.`;

    case "failure":
      return `## ❌ Repository Creation Failed

There was an error creating your repository. Please check the workflow logs for details.

You can close this issue and create a new one to try again.`;

    case "deleted":
      return `## 🗑️ Repository Deleted

The repository \`${repoName}\` has been deleted because this issue was closed.

If this was a mistake, you can create a new project request issue.`;

    case "no-repo":
      return `## ℹ️ Issue Closed

This issue was closed but no repository name was found in the title.`;

    case "repo-exists":
      return `## ⚠️ Repository Already Exists

A repository named \`${repoName}\` already exists.

Please choose a different project name and create a new issue.`;

    default:
      return `Comment type "${type}" not recognized.`;
  }
}

async function postComment(
  octokit: ReturnType<typeof getOctokit>,
  issueNumber: number,
  commentType: CommentType,
  params: CommentParams
): Promise<void> {
  const comment = generateComment(commentType, params);

  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    body: comment,
  });

  console.log(`✅ Posted "${commentType}" comment on issue #${issueNumber}`);
}

// ============================================
// Parse Issue Form
// ============================================

function parseFormField(body: string, fieldName: string): string | null {
  const regex = new RegExp(
    `### ${fieldName}\\s*\\n\\s*([\\s\\S]*?)(?=\\n###|$)`,
    "i"
  );
  const match = body.match(regex);
  return match ? match[1].trim() : null;
}

function parseGitHubAccounts(accountsText: string | null): string[] {
  if (!accountsText) return [];
  return accountsText
    .split("\n")
    .map((line) => line.trim().replace(/^@/, ""))
    .filter((line) => line.length > 0);
}

function extractProjectName(title: string): string {
  if (!title) return "";
  const match = title.match(/\[Project\]:\s*(.+)/i);
  return match ? match[1].trim() : "";
}

function sanitizeRepoName(projectName: string): string {
  if (!projectName) return "";
  return projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type ParseIssueFormResult =
  | {
      ok: true;
      status: string;
      message: string;
      data: {
        projectName: string;
        repoName: string;
        template: string;
        githubAccounts: string[];
        description: string;
        isPrivate: boolean;
      };
    }
  | {
      ok: false;
      status: string;
      message: string;
    };

function parseIssueForm(
  issueTitle: string,
  issueBody: string
): ParseIssueFormResult {
  const projectName = extractProjectName(issueTitle);
  const repoName = sanitizeRepoName(projectName);

  if (!repoName) {
    return {
      ok: false,
      status: "project_name_required",
      message: "Project name is required",
    };
  }

  if (projectName.length > 100) {
    return {
      ok: false,
      status: "project_name_too_long",
      message: "Project name is too long (max 100 characters)",
    };
  }

  const template = parseFormField(issueBody, "Template Repository");
  const description = parseFormField(issueBody, "Project Description");
  const isPrivate = issueBody.includes("[X] Make this repository private");
  const githubAccountsRaw = parseFormField(issueBody, "GitHub Accounts");
  const githubAccounts = parseGitHubAccounts(githubAccountsRaw);

  return {
    ok: true,
    status: "success",
    message: "Issue form parsed successfully",
    data: {
      projectName,
      repoName,
      template: template || "nestjs-template",
      githubAccounts,
      description: description || "",
      isPrivate,
    },
  };
}

// ============================================
// Validate Inputs
// ============================================

function validateRepoName(repoName: string): string[] {
  const errors: string[] = [];

  if (!repoName || repoName.length < 1) {
    errors.push("Project name is required");
  }

  if (repoName && repoName.length > 100) {
    errors.push("Project name is too long (max 100 characters)");
  }

  if (repoName && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(repoName)) {
    errors.push(
      "Repository name must start and end with alphanumeric characters"
    );
  }

  return errors;
}

async function isOrgOrUser(owner: string): Promise<"User" | "Organization"> {
  const octokit = getOctokit(process.env.GH_TOKEN!);
  const { data } = await octokit.rest.users.getByUsername({
    username: owner,
  });

  return data.type as "User" | "Organization";
}

function isUser(ownerType: "User" | "Organization"): boolean {
  return ownerType === "User";
}

function isOrg(ownerType: "User" | "Organization"): boolean {
  return ownerType === "Organization";
}

export async function getRepositories(owner: string) {
  const octokit = getOctokit(process.env.GH_TOKEN!);

  const ownerType = await isOrgOrUser(owner);

  if (isOrg(ownerType)) {
    const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
      org: owner,
      per_page: 100,
    });
    return repos;
  }

  if (isUser(ownerType)) {
    const repos = await octokit.paginate(octokit.rest.repos.listForUser, {
      username: owner,
      per_page: 100,
    });

    return repos;
  }

  return [];
}

async function main(): Promise<void> {
  const token = process.env.GH_TOKEN!;
  if (!token) {
    console.error("GH_TOKEN is not set");
    core.setFailed("GH_TOKEN is not set");
    return;
  }
  const issue = context.payload.issue;
  const body = issue?.body || "";
  const title = issue?.title || "";

  const result = parseIssueForm(title, body);
  if (!result.ok) {
    core.setFailed(result.message);
    return;
  }

  core.setOutput("projectName", result.data.projectName);
  core.setOutput("repoName", result.data.repoName);
  core.setOutput("templateRepo", result.data.template);
  core.setOutput("githubAccounts", JSON.stringify(result.data.githubAccounts));
  core.setOutput("description", result.data.description);
  core.setOutput("isPrivate", result.data.isPrivate);

  console.log("Parsed data:", result.data);
  const octokit = getOctokit(token);

  const owner = context.repo.owner;
  const repo = result.data.repoName;
  console.log("Owner:", owner);
  console.log("Repo:", repo);

  const repos = await getRepositories(owner);
  console.log("Repositories:", repos);

  // const existingRepo = repos.find((r) => r.name.toLowerCase() === repo.toLowerCase());

  // const exists = await checkRepoExists(octokit, owner, repo);
  // core.setOutput("exists", exists ? "true" : "false");
  // if (!parsed.ok) {
  //   throw new Error(parsed.data.message);
  // }

  // switch (action) {
  //   case "parse": {
  //     // const issueTitle = core.getInput("issue_title", { required: true });
  //     // const issueBody = core.getInput("issue_body", { required: true });

  //     const parsed = parseIssueForm(issueTitle, issueBody);

  //     console.log("Parsed data:");
  //     console.log("- Project Name:", parsed.projectName);
  //     console.log("- Repo Name:", parsed.repoName);
  //     console.log("- Template:", parsed.template);
  //     console.log("- Collaborators:", parsed.githubAccounts);
  //     console.log("- Private:", parsed.isPrivate);

  //     core.setOutput("project_name", parsed.projectName);
  //     core.setOutput("repo_name", parsed.repoName);
  //     core.setOutput("template", parsed.template);
  //     core.setOutput("collaborators", JSON.stringify(parsed.githubAccounts));
  //     core.setOutput("description", parsed.description);
  //     core.setOutput("is_private", String(parsed.isPrivate));

  //     // Also validate
  //     const errors = validateRepoName(parsed.repoName);
  //     if (errors.length > 0) {
  //       core.setOutput("valid", "false");
  //       core.setOutput("errors", errors.join(", "));
  //       console.log("❌ Validation errors:", errors.join(", "));
  //     } else {
  //       core.setOutput("valid", "true");
  //       core.setOutput("errors", "");
  //       console.log("✅ Validation passed");
  //     }
  //     break;
  //   }

  //   case "check-repo": {
  //     const owner = core.getInput("owner", { required: true });
  //     const repoName = core.getInput("repo_name", { required: true });

  //     const exists = await checkRepoExists(octokit, owner, repoName);
  //     core.setOutput("exists", exists ? "true" : "false");
  //     break;
  //   }

  //   case "comment": {
  //     const issueNumber = parseInt(
  //       core.getInput("issue_number", { required: true })
  //     );
  //     const commentType = core.getInput("comment_type") as CommentType;
  //     const repoName = core.getInput("repo_name") || "";
  //     const repoUrl = core.getInput("repo_url") || "";
  //     const template = core.getInput("template") || "";
  //     let collaborators: string[] = [];

  //     try {
  //       collaborators = JSON.parse(core.getInput("collaborators") || "[]");
  //     } catch {
  //       collaborators = [];
  //     }

  //     await postComment(octokit, issueNumber, commentType, {
  //       repoName,
  //       repoUrl,
  //       template,
  //       collaborators,
  //     });
  //     break;
  //   }

  //   default:
  //     core.setFailed(`Unknown action: ${action}`);
  // }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
  process.exit(1);
});
