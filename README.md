# RVM - Repository Version Manager

A GitHub-based system for creating and managing project repositories via issue forms.

## Features

- 📝 **Structured Issue Form** - Clean form for submitting project requests
- 🚀 **Automatic Repository Creation** - Creates repos from templates when issues are opened
- 🗑️ **Automatic Repository Deletion** - Deletes repos when issues are closed or labeled "closed"
- 👥 **Collaborator Management** - Automatically adds team members as collaborators
- ✅ **Validation** - Validates project names and GitHub usernames
- 💬 **Auto-Response** - Comments on issues with status updates

## How It Works

### Creating a Repository

1. Go to **Issues** → **New Issue**
2. Select **Project Request** template
3. Fill in:
   - **Project Name** - The name of the project (becomes repo name)
   - **Template Repository** - Select from available templates
   - **GitHub Accounts** - List of team member usernames (one per line)
   - **Description** (optional) - Project description
   - **Private Repository** - Check to make the repo private
4. Submit the issue
5. The workflow automatically:
   - Creates a new repository from the selected template
   - Adds collaborators with push access
   - Protects the default branch
   - Comments on the issue with the repository URL

### Deleting a Repository

Repositories are automatically deleted when:
- The issue is **closed**
- The label **"closed"** is added to the issue

A comment is posted on the issue confirming the deletion.

## File Structure

```
.github/
├── ISSUE_TEMPLATE/
│   └── project-request.yml           # Issue form template
├── actions/
│   ├── template-based-repo-creator/  # Action to create repos from templates
│   └── repo-deleter/                 # Action to delete repos
└── workflows/
    └── process-issue.yml             # Main lifecycle workflow

scripts/
├── parse-issue.js                    # Standalone parser (for testing)
└── actions/                          # Workflow action scripts
    ├── parse-issue-form.js           # Parse issue form data
    ├── validate-inputs.js            # Validate parsed inputs
    ├── add-collaborators.js          # Add users as collaborators
    ├── add-repo-label.js             # Add tracking label to issue
    ├── extract-repo-name.js          # Extract repo name from labels
    └── comment-on-issue.js           # Post comments on issues
```

## Configuration

### Required Secrets

You need to configure the following secret in your repository:

- **`GH_ADMIN_TOKEN`** - A GitHub Personal Access Token with the following permissions:
  - `repo` (Full control of private repositories)
  - `delete_repo` (Delete repositories)
  - `admin:org` (if creating repos in an organization)

### Environment Variables

Update these in `.github/workflows/process-issue.yml`:

```yaml
env:
  ORGANIZATION_NAME: your-org-or-username  # Where repos are created
```

### Template Repositories

Update the template options in `.github/ISSUE_TEMPLATE/project-request.yml`:

```yaml
- type: dropdown
  id: template
  attributes:
    label: Template Repository
    options:
      - your-template-1
      - your-template-2
```

Make sure your template repositories are marked as **template repositories** in their settings.

## Customization

### Adding More Form Fields

Edit `.github/ISSUE_TEMPLATE/project-request.yml` to add new fields:

```yaml
- type: input
  id: your-field-id
  attributes:
    label: Your Field Label
    description: Description of the field
  validations:
    required: true
```

Then update the workflow parsing logic to handle the new field.

### Custom Repository Settings

Modify the `process-issue.yml` workflow to add custom settings:

```yaml
- name: Configure Repository
  uses: actions/github-script@v7
  with:
    github-token: ${{ env.GH_ADMIN_TOKEN }}
    script: |
      // Add custom settings
      await github.rest.repos.update({
        owner: '${{ env.ORGANIZATION_NAME }}',
        repo: '${{ steps.parse.outputs.repo_name }}',
        has_issues: true,
        has_projects: true,
        has_wiki: false
      });
```

## API Reference (parse-issue.js)

### `parseIssueForm(issueBody)`

Parses the complete issue form body.

**Returns:**
```javascript
{
  projectName: string,
  githubAccounts: string[],
  description: string | null
}
```

### `validateFormData(formData)`

Validates the parsed form data.

**Returns:**
```javascript
{
  isValid: boolean,
  errors: string[]
}
```

## Testing

### Testing the Parser Locally

```bash
node scripts/parse-issue.js
```

### Building Actions Locally

```bash
# Build repo creator
cd .github/actions/template-based-repo-creator
npm install && npm run build

# Build repo deleter
cd .github/actions/repo-deleter
npm install && npm run build
```

## Workflow

```
┌─────────────────────────────────────────────────────────┐
│                    Issue Created                         │
│              (with project-request label)               │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Parse Issue Form Data                       │
│  • Project name → repo name                             │
│  • Template selection                                    │
│  • Team members                                          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│         Create Repository from Template                  │
│  • Create from selected template                        │
│  • Set visibility (public/private)                      │
│  • Protect default branch                               │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Add Collaborators                           │
│  • Add team members with push access                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Comment on Issue                            │
│  • Post repository URL                                  │
│  • List added collaborators                             │
│  • Add repo:name label for tracking                     │
└─────────────────────────────────────────────────────────┘

         ═══════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│            Issue Closed / Labeled "closed"              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Delete Repository                           │
│  • Find repo name from repo:* label                     │
│  • Delete the repository                                │
│  • Comment confirmation                                  │
└─────────────────────────────────────────────────────────┘
```

## Security Considerations

- The `GH_ADMIN_TOKEN` secret should have minimal necessary permissions
- Consider using a dedicated service account for the token
- Repository deletion is permanent - there's no undo
- The workflow only triggers on issues with the `project-request` label

## License

MIT
