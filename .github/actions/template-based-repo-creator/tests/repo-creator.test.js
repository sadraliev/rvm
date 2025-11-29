import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
import { createTemplateBasedRepository } from "../repo-creator.js";

// Mock console.log to test logging
const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

describe("Create Repo From Template Action", () => {
  let mockRequest;
  let defaultParams;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = vi.fn();
    github.getOctokit.mockReturnValue({
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
          template_owner: "template-owner",
          template_repo: "template-repo",
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
      expect(core.setOutput).toHaveBeenCalledTimes(1);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Repository created: https://github.com/my-org/generated-repo"
      );
    });

    it("creates a public repository when private is set to false", async () => {
      const params = { ...defaultParams, isPrivate: false };
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
      const params = { ...defaultParams, isPrivate: undefined };
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
      const params = {
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
          template_owner: defaultParams.templateOwner,
          template_repo: defaultParams.templateRepo,
          owner: defaultParams.newRepoOwner,
          name: defaultParams.newRepoName,
          private: defaultParams.isPrivate,
        })
      );
    });

    it("handles isPrivate as true", async () => {
      const params = { ...defaultParams, isPrivate: true };
      mockRequest.mockResolvedValue({
        data: { html_url: "https://github.com/my-org/generated-repo" },
      });

      await createTemplateBasedRepository(params);

      const callArgs = mockRequest.mock.calls[0][1];
      expect(callArgs.private).toBe(true);
      expect(typeof callArgs.private).toBe("boolean");
    });

    it("handles isPrivate as false", async () => {
      const params = { ...defaultParams, isPrivate: false };
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
