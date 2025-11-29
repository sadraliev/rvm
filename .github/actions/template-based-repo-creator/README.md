# GitHub Repo Vending Machine: Creating a Token for Your Custom Action

If you are building a GitHub Action to create repositories from a template, you need a **Personal Access Token (PAT)**. This guide explains how to create one, store it securely, and use it in your workflows.

---

## 1️⃣ Create a Personal Access Token (PAT)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token**  
   *(If you are using an organization, you can create a fine-grained PAT.)*

2. Select the scopes needed:

| Scope      | Purpose |
|------------|---------|
| `repo`     | Create public & private repositories, manage contents |
| `admin:org` | Required only if creating repos in an organization |

3. Give the token a descriptive name, e.g., `Repo Vending Machine Token`.

4. Click **Generate token**.

5. Copy the token immediately. You **cannot view it again** later.

---

## 2️⃣ Store the Token as a GitHub Secret

1. Go to your repository: **Settings → Secrets and variables → Actions → New repository secret**  

2. Name it, for example: GH_ADMIN_TOKEN

3. Paste the PAT and save.

> **Security tip:** Never hardcode your token in workflows. Always use repository secrets.

---

## 3️⃣ Use the Token in Your GitHub Action

Update your workflow `.yml` file to include the secret:

```yaml
jobs:
  create:
    runs-on: ubuntu-latest
    steps:
      - name: Create repository
        uses: my-org/create-repo-from-template-action@v1
        with:
          token: ${{ secrets.GH_ADMIN_TOKEN }}  # <- use the secret here
          template_owner: my-org
          template_repo: template-service
          new_repo_owner: my-org
          new_repo_name: new-microservice-123
          private: true


