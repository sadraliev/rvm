/**
 * Extract Repository Name from Labels
 * 
 * Extracts the repository name from issue labels (format: repo:name).
 * 
 * Required environment variables:
 * - ISSUE_LABELS: JSON array of label objects
 * - GITHUB_OUTPUT: Path to output file (set by GitHub Actions)
 */

const fs = require('fs');

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
  const labelsJson = process.env.ISSUE_LABELS || '[]';
  
  let labels;
  try {
    labels = JSON.parse(labelsJson);
  } catch (e) {
    console.error('Failed to parse ISSUE_LABELS:', e.message);
    setOutput('repo_name', '');
    setOutput('should_delete', 'false');
    return;
  }

  // Find the repo label (format: repo:repo-name)
  const repoLabel = labels.find(l => l.name && l.name.startsWith('repo:'));

  if (!repoLabel) {
    console.log('No repository label found on this issue');
    setOutput('repo_name', '');
    setOutput('should_delete', 'false');
    return;
  }

  const repoName = repoLabel.name.replace('repo:', '');
  console.log('Found repository to delete:', repoName);

  setOutput('repo_name', repoName);
  setOutput('should_delete', 'true');
}

main();

