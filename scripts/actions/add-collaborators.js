/**
 * Add Collaborators
 * 
 * Adds GitHub users as collaborators to a repository.
 * 
 * Required environment variables:
 * - GITHUB_TOKEN: GitHub token with repo permissions
 * - REPO_OWNER: Repository owner
 * - REPO_NAME: Repository name
 * - GITHUB_ACCOUNTS: JSON array of GitHub usernames
 */

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;
  const accountsJson = process.env.GITHUB_ACCOUNTS || '[]';

  if (!token || !owner || !repo) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  let accounts;
  try {
    accounts = JSON.parse(accountsJson);
  } catch (e) {
    console.error('Failed to parse GITHUB_ACCOUNTS:', e.message);
    process.exit(1);
  }

  if (accounts.length === 0) {
    console.log('No collaborators to add');
    return;
  }

  console.log(`Adding ${accounts.length} collaborator(s) to ${owner}/${repo}`);

  for (const username of accounts) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/collaborators/${username}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ permission: 'push' })
        }
      );

      if (response.ok || response.status === 201 || response.status === 204) {
        console.log(`✅ Added ${username} as collaborator`);
      } else {
        const error = await response.json();
        console.log(`⚠️ Could not add ${username}: ${error.message || response.statusText}`);
      }
    } catch (error) {
      console.log(`⚠️ Could not add ${username}: ${error.message}`);
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

