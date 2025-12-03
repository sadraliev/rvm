/**
 * Issue Form Parser
 * 
 * This script parses GitHub issue form submissions to extract
 * project name and GitHub accounts.
 * 
 * Can be used standalone or as a module in GitHub Actions.
 */

/**
 * Parse a specific field from the issue body
 * @param {string} body - The issue body text
 * @param {string} fieldName - The name of the field to parse
 * @returns {string|null} The field value or null if not found
 */
function parseFormField(body, fieldName) {
  const regex = new RegExp(`### ${fieldName}\\s*\\n\\s*([\\s\\S]*?)(?=\\n###|$)`, 'i');
  const match = body.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parse GitHub accounts from a multiline string
 * @param {string} accountsText - Multiline string with one account per line
 * @returns {string[]} Array of GitHub usernames
 */
function parseGitHubAccounts(accountsText) {
  if (!accountsText) return [];
  
  return accountsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    // Remove @ prefix if present
    .map(account => account.startsWith('@') ? account.slice(1) : account);
}

/**
 * Parse the complete issue form
 * @param {string} issueBody - The raw issue body from GitHub
 * @returns {Object} Parsed form data
 */
function parseIssueForm(issueBody) {
  const projectName = parseFormField(issueBody, 'Project Name');
  const githubAccountsRaw = parseFormField(issueBody, 'GitHub Accounts');
  const description = parseFormField(issueBody, 'Project Description');
  
  return {
    projectName,
    githubAccounts: parseGitHubAccounts(githubAccountsRaw),
    description: description || null,
    raw: {
      projectName,
      githubAccountsRaw,
      description
    }
  };
}

/**
 * Validate the parsed form data
 * @param {Object} formData - Parsed form data
 * @returns {Object} Validation result with isValid flag and errors array
 */
function validateFormData(formData) {
  const errors = [];
  
  if (!formData.projectName || formData.projectName.trim() === '') {
    errors.push('Project name is required');
  }
  
  if (!formData.githubAccounts || formData.githubAccounts.length === 0) {
    errors.push('At least one GitHub account is required');
  }
  
  // Validate GitHub usernames format
  const invalidAccounts = formData.githubAccounts.filter(
    account => !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(account)
  );
  
  if (invalidAccounts.length > 0) {
    errors.push(`Invalid GitHub username(s): ${invalidAccounts.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// CLI usage
if (require.main === module) {
  // Example issue body for testing
  const exampleIssueBody = `### Project Name

my-awesome-project

### GitHub Accounts

octocat
hubot
monalisa

### Project Description

This is a test project for demonstration purposes.`;

  console.log('=== Issue Form Parser ===\n');
  console.log('Input:');
  console.log(exampleIssueBody);
  console.log('\n--- Parsed Output ---\n');
  
  const parsed = parseIssueForm(exampleIssueBody);
  console.log(JSON.stringify(parsed, null, 2));
  
  console.log('\n--- Validation ---\n');
  const validation = validateFormData(parsed);
  console.log('Valid:', validation.isValid);
  if (!validation.isValid) {
    console.log('Errors:', validation.errors);
  }
}

module.exports = {
  parseFormField,
  parseGitHubAccounts,
  parseIssueForm,
  validateFormData
};

