import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

vi.mock("@actions/core", () => {
  return {
    getInput: vi.fn(),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
  };
});

vi.mock("@actions/github", () => {
  return {
    getOctokit: vi.fn(() => ({
      request: vi.fn(),
    })),
  };
});

import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  createTemplateBasedRepository,
  protectDefaultBranch,
  type CreateRepoParams,
  type ProtectDefaultBranchParams,
} from "../repo-creator.js";

// Mock console.log to test logging
const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

describe("Create Repo From Template Action", () => {
  let mockRequest: Mock;
  let defaultParams: CreateRepoParams;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = vi.fn();
    (github.getOctokit as Mock).mockReturnValue({
      request: mockRequest,
    });

    defaultParams = {
      token: "TEST_TOKEN",
      templateOwner: "template-owner",
      templateRepo: "template-repo",
      newRepoOwner: "my-org",
      newRepoName: "generated-repo",
      isPrivate: true,
    };
  });

  afterEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  describe("Successful repository creation", () => {
    it("creates a private repository with all required parameters", async () => {
      mockRequest.mockResolvedValue({
        data: {
          html_url: `https://github.com/${defaultParams.newRepoOwner}/${defaultParams.newRepoName}`,
        },
      });

      await createTemplateBasedRepository(defaultParams);

      expect(github.getOctokit).toHaveBeenCalledWith("TEST_TOKEN");
      expect(github.getOctokit).toHaveBeenCalledTimes(1);

      expect(mockRequest).toHaveBeenCalledWith(
        `POST /repos/${defaultParams.templateOwner}/${defaultParams.templateRepo}/generate`,
        {
          owner: "my-org",
          name: "generated-repo",
          private: true,
          description:
            "Repository created from template template-owner/template-repo",
          headers: {
            accept: "application/vnd.github.baptiste-preview+json",
          },
        }
      );
      expect(mockRequest).toHaveBeenCalledTimes(1);

      expect(core.setOutput).toHaveBeenCalledWith(
        "repository_url",
        "https://github.com/my-org/generated-repo"
      );
      expect(core.setOutput).toHaveBeenCalledTimes(2);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Repository created: https://github.com/my-org/generated-repo"
      );
    });

    it("creates a public repository when private is set to false", async () => {
      const params: CreateRepoParams = { ...defaultParams, isPrivate: false };
      mockRequest.mockResolvedValue({
        data: { html_url: "https://github.com/my-org/public-repo" },
      });

      await createTemplateBasedRepository(params);

      expect(mockRequest).toHaveBeenCalledWith(
        `POST /repos/${params.templateOwner}/${params.templateRepo}/generate`,
        expect.objectContaining({
          private: false,
        })
      );
    });

    it("creates a public repository when private input is not provided", async () => {
      const params: CreateRepoParams = {
        ...defaultParams,
        isPrivate: undefined as any,
      };
      mockRequest.mockResolvedValue({
        data: { html_url: "https://github.com/my-org/public-repo" },
      });

      await createTemplateBasedRepository(params);

      expect(mockRequest).toHaveBeenCalledWith(
        `POST /repos/${params.templateOwner}/${params.templateRepo}/generate`,
        expect.objectContaining({
          private: undefined,
        })
      );
    });

    it("generates correct description with template information", async () => {
      const params: CreateRepoParams = {
        ...defaultParams,
        templateOwner: "awesome-org",
        templateRepo: "awesome-template",
      };
      mockRequest.mockResolvedValue({
        data: { html_url: "https://github.com/my-org/new-repo" },
      });

      await createTemplateBasedRepository(params);

      expect(mockRequest).toHaveBeenCalledWith(
        `POST /repos/${params.templateOwner}/${params.templateRepo}/generate`,
        expect.objectContaining({
          description:
            "Repository created from template awesome-org/awesome-template",
        })
      );
    });

    it("uses correct GitHub API preview header", async () => {
      mockRequest.mockResolvedValue({
        data: { html_url: "https://github.com/my-org/generated-repo" },
      });

      await createTemplateBasedRepository(defaultParams);

      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            accept: "application/vnd.github.baptiste-preview+json",
          },
        })
      );
    });
  });

  describe("Error handling", () => {
    it("handles API request failures", async () => {
      mockRequest.mockRejectedValue(new Error("API request failed"));

      await createTemplateBasedRepository(defaultParams);

      expect(core.setFailed).toHaveBeenCalledWith("API request failed");
      expect(core.setFailed).toHaveBeenCalledTimes(1);
      expect(core.setOutput).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("handles authentication errors", async () => {
      mockRequest.mockRejectedValue(new Error("Bad credentials"));

      await createTemplateBasedRepository(defaultParams);

      expect(core.setFailed).toHaveBeenCalledWith("Bad credentials");
    });

    it("handles rate limit errors", async () => {
      mockRequest.mockRejectedValue(new Error("API rate limit exceeded"));

      await createTemplateBasedRepository(defaultParams);

      expect(core.setFailed).toHaveBeenCalledWith("API rate limit exceeded");
    });

    it("handles repository already exists error", async () => {
      mockRequest.mockRejectedValue(new Error("Repository already exists"));

      await createTemplateBasedRepository(defaultParams);

      expect(core.setFailed).toHaveBeenCalledWith("Repository already exists");
    });

    it("handles network errors", async () => {
      mockRequest.mockRejectedValue(new Error("Network request failed"));

      await createTemplateBasedRepository(defaultParams);

      expect(core.setFailed).toHaveBeenCalledWith("Network request failed");
    });

    it("handles template not found errors", async () => {
      mockRequest.mockRejectedValue(new Error("Not Found"));

      await createTemplateBasedRepository(defaultParams);

      expect(core.setFailed).toHaveBeenCalledWith("Not Found");
    });

    it("ensures setOutput is not called when request fails", async () => {
      mockRequest.mockRejectedValue(new Error("Some error"));

      await createTemplateBasedRepository(defaultParams);

      expect(core.setOutput).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe("Parameter handling", () => {
    it("accepts all required parameters", async () => {
      mockRequest.mockResolvedValue({
        data: {
          html_url: `https://github.com/${defaultParams.newRepoOwner}/${defaultParams.newRepoName}`,
        },
      });

      await createTemplateBasedRepository(defaultParams);

      expect(github.getOctokit).toHaveBeenCalledWith(defaultParams.token);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          owner: defaultParams.newRepoOwner,
          name: defaultParams.newRepoName,
          private: defaultParams.isPrivate,
        })
      );
    });

    it("handles isPrivate as true", async () => {
      const params: CreateRepoParams = { ...defaultParams, isPrivate: true };
      mockRequest.mockResolvedValue({
        data: { html_url: "https://github.com/my-org/generated-repo" },
      });

      await createTemplateBasedRepository(params);

      const callArgs = mockRequest.mock.calls[0][1];
      expect(callArgs.private).toBe(true);
      expect(typeof callArgs.private).toBe("boolean");
    });

    it("handles isPrivate as false", async () => {
      const params: CreateRepoParams = { ...defaultParams, isPrivate: false };
      mockRequest.mockResolvedValue({
        data: {
          html_url: `https://github.com/${params.newRepoOwner}/${params.newRepoName}`,
        },
      });

      await createTemplateBasedRepository(params);

      const callArgs = mockRequest.mock.calls[0][1];
      expect(callArgs.private).toBe(false);
    });
  });

  describe("Output handling", () => {
    it("sets repository_url output with correct value", async () => {
      const expectedUrl = "https://github.com/test-org/test-repo";
      mockRequest.mockResolvedValue({
        data: { html_url: expectedUrl },
      });

      await createTemplateBasedRepository(defaultParams);

      expect(core.setOutput).toHaveBeenCalledWith(
        "repository_url",
        expectedUrl
      );
    });

    it("logs repository creation success message", async () => {
      const expectedUrl = `https://github.com/${defaultParams.newRepoOwner}/${defaultParams.newRepoName}`;
      mockRequest.mockResolvedValue({
        data: { html_url: expectedUrl },
      });

      await createTemplateBasedRepository(defaultParams);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Repository created: ${expectedUrl}`
      );
    });
  });
});

describe("Protect Default Branch", () => {
  let mockRequest: Mock;
  let defaultProtectParams: ProtectDefaultBranchParams;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = vi.fn();
    (github.getOctokit as Mock).mockReturnValue({
      request: mockRequest,
    });

    defaultProtectParams = {
      token: "TEST_TOKEN",
      owner: "test-org",
      repo: "test-repo",
      branch: "main",
    };
  });

  afterEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  describe("Successful branch protection", () => {
    it("protects branch with correct parameters", async () => {
      mockRequest.mockResolvedValue({ data: {} });

      await protectDefaultBranch(defaultProtectParams);

      expect(github.getOctokit).toHaveBeenCalledWith("TEST_TOKEN");
      expect(mockRequest).toHaveBeenCalledWith(
        `PUT /repos/${defaultProtectParams.owner}/${defaultProtectParams.repo}/branches/${defaultProtectParams.branch}/protection`,
        {
          required_status_checks: {
            strict: true,
            contexts: [],
          },
          enforce_admins: true,
          required_pull_request_reviews: {
            required_approving_review_count: 1,
          },
          restrictions: null,
          headers: {
            accept: "application/vnd.github+json",
          },
        }
      );
    });

    it("logs protection start message", async () => {
      mockRequest.mockResolvedValue({ data: {} });

      await protectDefaultBranch(defaultProtectParams);

      expect(consoleLogSpy).toHaveBeenCalledWith("Protecting branch main...");
    });

    it("logs protection success message", async () => {
      mockRequest.mockResolvedValue({ data: {} });

      await protectDefaultBranch(defaultProtectParams);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Branch main is now protected."
      );
    });

    it("protects custom branch name", async () => {
      const params = { ...defaultProtectParams, branch: "develop" };
      mockRequest.mockResolvedValue({ data: {} });

      await protectDefaultBranch(params);

      expect(mockRequest).toHaveBeenCalledWith(
        `PUT /repos/${params.owner}/${params.repo}/branches/${params.branch}/protection`,
        expect.objectContaining({
          required_status_checks: expect.any(Object),
        })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Protecting branch develop..."
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Branch develop is now protected."
      );
    });

    it("enforces admins by default", async () => {
      mockRequest.mockResolvedValue({ data: {} });

      await protectDefaultBranch(defaultProtectParams);

      const callArgs = mockRequest.mock.calls[0][1];
      expect(callArgs.enforce_admins).toBe(true);
    });

    it("requires 1 approving review", async () => {
      mockRequest.mockResolvedValue({ data: {} });

      await protectDefaultBranch(defaultProtectParams);

      const callArgs = mockRequest.mock.calls[0][1];
      expect(
        callArgs.required_pull_request_reviews.required_approving_review_count
      ).toBe(1);
    });

    it("requires strict status checks", async () => {
      mockRequest.mockResolvedValue({ data: {} });

      await protectDefaultBranch(defaultProtectParams);

      const callArgs = mockRequest.mock.calls[0][1];
      expect(callArgs.required_status_checks.strict).toBe(true);
    });

    it("sets no branch restrictions", async () => {
      mockRequest.mockResolvedValue({ data: {} });

      await protectDefaultBranch(defaultProtectParams);

      const callArgs = mockRequest.mock.calls[0][1];
      expect(callArgs.restrictions).toBe(null);
    });
  });

  describe("Error handling", () => {
    it("handles API request failures", async () => {
      mockRequest.mockRejectedValue(new Error("Branch protection failed"));

      await protectDefaultBranch(defaultProtectParams);

      expect(core.setFailed).toHaveBeenCalledWith("Branch protection failed");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("handles authentication errors", async () => {
      mockRequest.mockRejectedValue(new Error("Bad credentials"));

      await protectDefaultBranch(defaultProtectParams);

      expect(core.setFailed).toHaveBeenCalledWith("Bad credentials");
    });

    it("handles insufficient permissions", async () => {
      mockRequest.mockRejectedValue(
        new Error("Resource not accessible by integration")
      );

      await protectDefaultBranch(defaultProtectParams);

      expect(core.setFailed).toHaveBeenCalledWith(
        "Resource not accessible by integration"
      );
    });

    it("handles branch not found errors", async () => {
      mockRequest.mockRejectedValue(new Error("Branch not found"));

      await protectDefaultBranch(defaultProtectParams);

      expect(core.setFailed).toHaveBeenCalledWith("Branch not found");
    });

    it("handles network errors", async () => {
      mockRequest.mockRejectedValue(new Error("Network request failed"));

      await protectDefaultBranch(defaultProtectParams);

      expect(core.setFailed).toHaveBeenCalledWith("Network request failed");
    });

    it("logs error to console", async () => {
      const error = new Error("Some error");
      mockRequest.mockRejectedValue(error);

      await protectDefaultBranch(defaultProtectParams);

      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    it("handles string errors", async () => {
      mockRequest.mockRejectedValue("String error message");

      await protectDefaultBranch(defaultProtectParams);

      expect(core.setFailed).toHaveBeenCalledWith("String error message");
    });

    it("does not log success messages on error", async () => {
      mockRequest.mockRejectedValue(new Error("Failed"));

      await protectDefaultBranch(defaultProtectParams);

      expect(consoleLogSpy).toHaveBeenCalledWith("Protecting branch main...");
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        "Branch main is now protected."
      );
    });
  });

  describe("Parameter validation", () => {
    it("uses correct token for authentication", async () => {
      const params = { ...defaultProtectParams, token: "CUSTOM_TOKEN" };
      mockRequest.mockResolvedValue({ data: {} });

      await protectDefaultBranch(params);

      expect(github.getOctokit).toHaveBeenCalledWith("CUSTOM_TOKEN");
    });

    it("works with different owner and repo", async () => {
      const params = {
        ...defaultProtectParams,
        owner: "different-org",
        repo: "different-repo",
      };
      mockRequest.mockResolvedValue({ data: {} });

      await protectDefaultBranch(params);

      expect(mockRequest).toHaveBeenCalledWith(
        `PUT /repos/${params.owner}/${params.repo}/branches/${params.branch}/protection`,
        expect.any(Object)
      );
    });

    it("handles branch names with special characters", async () => {
      const params = { ...defaultProtectParams, branch: "feature/test-123" };
      mockRequest.mockResolvedValue({ data: {} });

      await protectDefaultBranch(params);

      expect(mockRequest).toHaveBeenCalledWith(
        `PUT /repos/${params.owner}/${params.repo}/branches/${params.branch}/protection`,
        expect.any(Object)
      );
    });
  });
});
