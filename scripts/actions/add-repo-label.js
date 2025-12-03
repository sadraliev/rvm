/**
 * Add Repository Label
 * 
 * Creates a label to track the repository and adds it to the issue.
 * 
 * Required environment variables:
 * - GITHUB_TOKEN: GitHub token
 * - GITHUB_REPOSITORY: Repository in owner/repo format
 * - ISSUE_NUMBER: The issue number
 * - REPO_NAME: The created repository name (for the label)
 */

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const issueNumber = process.env.ISSUE_NUMBER;
  const repoName = process.env.REPO_NAME;

  if (!token || !repository || !issueNumber || !repoName) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const [owner, repo] = repository.split('/');
  const labelName = `repo:${repoName}`;

  console.log(`Adding label "${labelName}" to issue #${issueNumber}`);

  // Create label if it doesn't exist
  try {
    const createResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/labels`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: labelName,
          color: '0366d6',
          description: `Tracks repository: ${repoName}`
        })
      }
    );

    if (createResponse.ok) {
      console.log(`✅ Created label "${labelName}"`);
    } else if (createResponse.status === 422) {
      console.log(`Label "${labelName}" already exists`);
    }
  } catch (error) {
    console.log(`Label creation skipped: ${error.message}`);
  }

  // Add label to issue
  const addResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ labels: [labelName] })
    }
  );

  if (addResponse.ok) {
    console.log(`✅ Added label to issue #${issueNumber}`);
  } else {
    const error = await addResponse.json();
    console.error(`❌ Failed to add label: ${error.message || addResponse.statusText}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

