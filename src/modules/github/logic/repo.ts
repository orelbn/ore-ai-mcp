import { AppError } from "@/lib/errors";

export function requireRepoName(repo: string): string {
  const trimmed = repo.trim();
  if (!trimmed) {
    throw new AppError("INVALID_INPUT", "repo is required", 400);
  }
  if (!trimmed.includes("/")) {
    return trimmed;
  }

  const parts = trimmed.split("/");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return parts[1];
  }

  throw new AppError("INVALID_INPUT", "repo must be a repository name or <owner>/<repo>", 400);
}
