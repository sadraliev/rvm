/**
 * Validate Inputs
 * 
 * Validates the parsed issue form data.
 * 
 * Required environment variables:
 * - REPO_NAME: The sanitized repository name
 */

/**
 * Validate repository name
 */
function validateRepoName(repoName) {
  const errors = [];

  if (!repoName || repoName.length < 1) {
    errors.push('Project name is required');
  }

  if (repoName && repoName.length > 100) {
    errors.push('Project name is too long (max 100 characters)');
  }

  // GitHub repo name rules
  if (repoName && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(repoName)) {
    errors.push('Repository name must start and end with alphanumeric characters');
  }

  return errors;
}

/**
 * Main function
 */
function main() {
  const repoName = process.env.REPO_NAME || '';
  
  console.log(`Validating repository name: "${repoName}"`);
  
  const errors = validateRepoName(repoName);
  
  if (errors.length > 0) {
    console.error('❌ Validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
  
  console.log('✅ Validation passed');
}

main();

module.exports = { validateRepoName };

