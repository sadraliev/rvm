/**
 * Parse Issue Form
 * 
 * Parses GitHub issue form data and sets outputs for the workflow.
 * 
 * Required environment variables:
 * - ISSUE_BODY: The issue body content
 * - ISSUE_NUMBER: The issue number
 * - GITHUB_OUTPUT: Path to output file (set by GitHub Actions)
 */

const fs = require('fs');

/**
 * Parse a specific field from the issue body
 */
function parseFormField(body, fieldName) {
  const regex = new RegExp(`### ${fieldName}\\s*\\n\\s*([\\s\\S]*?)(?=\\n###|$)`, 'i');
  const match = body.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parse GitHub accounts from multiline text
 */
function parseGitHubAccounts(accountsText) {
  if (!accountsText) return [];
  
  return accountsText
    .split('\n')
    .map(line => line.trim().replace(/^@/, ''))
    .filter(line => line.length > 0);
}

/**
 * Sanitize project name for use as repository name
 */
function sanitizeRepoName(projectName) {
  if (!projectName) return '';
  
  return projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Set GitHub Actions output
 */
function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  }
  console.log(`Output: ${name}=${value}`);
}

/**
 * Main function
 */
function main() {
  const issueBody = process.env.ISSUE_BODY || '';
  const issueNumber = process.env.ISSUE_NUMBER || '';

  console.log(`Processing issue #${issueNumber}`);

  // Parse form fields
  const projectName = parseFormField(issueBody, 'Project Name');
  const template = parseFormField(issueBody, 'Template Repository');
  const githubAccountsRaw = parseFormField(issueBody, 'GitHub Accounts');
  const description = parseFormField(issueBody, 'Project Description');
  const isPrivate = issueBody.includes('[X] Make this repository private');

  // Process data
  const githubAccounts = parseGitHubAccounts(githubAccountsRaw);
  const repoName = sanitizeRepoName(projectName);

  console.log('Parsed data:');
  console.log('- Project Name:', projectName);
  console.log('- Repo Name:', repoName);
  console.log('- Template:', template);
  console.log('- GitHub Accounts:', githubAccounts);
  console.log('- Private:', isPrivate);

  // Set outputs
  setOutput('project_name', projectName || '');
  setOutput('repo_name', repoName);
  setOutput('template', template || 'nestjs-template');
  setOutput('github_accounts', JSON.stringify(githubAccounts));
  setOutput('description', description || '');
  setOutput('issue_number', issueNumber);
  setOutput('is_private', isPrivate);
}

main();

module.exports = {
  parseFormField,
  parseGitHubAccounts,
  sanitizeRepoName
};

