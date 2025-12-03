/**
 * Comment on Issue
 * 
 * Posts a comment on a GitHub issue.
 * 
 * Required environment variables:
 * - GITHUB_TOKEN: GitHub token
 * - GITHUB_REPOSITORY: Repository in owner/repo format
 * - ISSUE_NUMBER: The issue number
 * - COMMENT_TYPE: Type of comment (success, failure, deleted, no-repo)
 * 
 * Optional environment variables (depending on COMMENT_TYPE):
 * - PROJECT_NAME: Project name
 * - REPO_NAME: Repository name
 * - REPO_URL: Repository URL
 * - TEMPLATE: Template name
 * - GITHUB_ACCOUNTS: JSON array of collaborator usernames
 */

/**
 * Generate comment based on type
 */
function generateComment(type) {
  const projectName = process.env.PROJECT_NAME || '';
  const repoName = process.env.REPO_NAME || '';
  const repoUrl = process.env.REPO_URL || '';
  const template = process.env.TEMPLATE || '';
  const accountsJson = process.env.GITHUB_ACCOUNTS || '[]';

  let accounts = [];
  try {
    accounts = JSON.parse(accountsJson);
  } catch (e) {
    accounts = [];
  }

  const accountsList = accounts.map(a => `- @${a}`).join('\n');

  switch (type) {
    case 'success':
      return `## ✅ Repository Created Successfully!

**Repository:** [${repoName}](${repoUrl})
**Template:** \`${template}\`

**Collaborators Added:**
${accountsList || '_No collaborators specified_'}

---

⚠️ **Important:** Closing this issue or adding the \`closed\` label will **delete** the repository.`;

    case 'failure':
      return `## ❌ Repository Creation Failed

There was an error creating your repository. Please check the workflow logs for details.

You can close this issue and create a new one to try again.`;

    case 'deleted':
      return `## 🗑️ Repository Deleted

The repository \`${repoName}\` has been deleted because this issue was closed.

If this was a mistake, you can create a new project request issue.`;

    case 'no-repo':
      return `## ℹ️ Issue Closed

This issue was closed but no associated repository was found to delete.

This could mean:
- The repository was already deleted
- The repository was never created successfully
- The issue was closed before the repository was created`;

    default:
      return `Comment type "${type}" not recognized.`;
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const issueNumber = process.env.ISSUE_NUMBER;
  const commentType = process.env.COMMENT_TYPE;

  if (!token || !repository || !issueNumber || !commentType) {
    console.error('Missing required environment variables');
    console.error('Required: GITHUB_TOKEN, GITHUB_REPOSITORY, ISSUE_NUMBER, COMMENT_TYPE');
    process.exit(1);
  }

  const [owner, repo] = repository.split('/');
  const comment = generateComment(commentType);

  console.log(`Posting "${commentType}" comment on issue #${issueNumber}`);

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body: comment })
    }
  );

  if (response.ok) {
    console.log('✅ Comment posted successfully');
  } else {
    const error = await response.json();
    console.error(`❌ Failed to post comment: ${error.message || response.statusText}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

