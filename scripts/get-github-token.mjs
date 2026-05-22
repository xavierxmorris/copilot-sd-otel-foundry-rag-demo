import { execFileSync } from "node:child_process";

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

try {
  if (process.env.GITHUB_TOKEN) {
    process.exit(0);
  }

  const token = run("gh", ["auth", "token"]);
  if (!token) {
    console.warn("gh auth token returned no token. Continuing without GITHUB_TOKEN.");
    process.exit(0);
  }

  run("azd", ["env", "set", "GITHUB_TOKEN", token]);
  console.log("Stored GITHUB_TOKEN in the active azd environment.");
} catch {
  console.warn("Unable to populate GITHUB_TOKEN automatically.");
  console.warn("Run 'azd env set GITHUB_TOKEN \"$(gh auth token)\"' before enabling Copilot SDK traces.");
}

