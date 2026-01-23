import * as fs from "fs";
import * as path from "path";
import { Skill, SkillMetadata, loadSkillsSettings, updateSkillsList } from "./skills-store.js";

const SKILLS_CACHE_DIR = "skills-cache";

// In bundled CJS, require is available. In ESM dev, we need createRequire.
import { createRequire } from "module";
const require = typeof globalThis.require === "function" ? globalThis.require : createRequire(import.meta.url);

function getUserDataDir(): string {
  const envDir = process.env.LOCALDESK_USER_DATA_DIR;
  if (envDir && envDir.trim()) return envDir;

  const electronVersion = (process.versions as any)?.electron;
  if (!electronVersion) {
    throw new Error("[SkillsLoader] LOCALDESK_USER_DATA_DIR is required outside Electron");
  }

  const electron = require("electron");
  return electron.app.getPath("userData");
}

interface GitHubContent {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url?: string;
  url: string;
}

function getCacheDir(): string {
  return path.join(getUserDataDir(), SKILLS_CACHE_DIR);
}

function ensureCacheDir(): void {
  const cacheDir = getCacheDir();
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

/**
 * Parse SKILL.md frontmatter to extract metadata
 */
function parseSkillMd(content: string): SkillMetadata | null {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  const metadata: SkillMetadata = {
    name: "",
    description: ""
  };

  // Parse YAML-like frontmatter (simple parser)
  const lines = frontmatter.split(/\r?\n/);
  let currentKey = "";
  let inMetadata = false;

  for (const line of lines) {
    if (line.startsWith("metadata:")) {
      inMetadata = true;
      metadata.metadata = {};
      continue;
    }

    if (inMetadata && line.match(/^\s{2}\w+:/)) {
      const match = line.match(/^\s{2}(\w+):\s*"?([^"]*)"?$/);
      if (match && metadata.metadata) {
        metadata.metadata[match[1]] = match[2];
      }
      continue;
    }

    if (!line.startsWith(" ") && line.includes(":")) {
      inMetadata = false;
      const colonIndex = line.indexOf(":");
      currentKey = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, "");

      switch (currentKey) {
        case "name":
          metadata.name = value;
          break;
        case "description":
          metadata.description = value;
          break;
        case "license":
          metadata.license = value;
          break;
        case "compatibility":
          metadata.compatibility = value;
          break;
        case "allowed-tools":
          metadata.allowedTools = value.split(/\s+/);
          break;
      }
    }
  }

  return metadata.name && metadata.description ? metadata : null;
}

/**
 * Fetch skill list from GitHub marketplace
 */
export async function fetchSkillsFromMarketplace(): Promise<Skill[]> {
  const settings = loadSkillsSettings();
  const marketplaceUrl = settings.marketplaceUrl;

  console.log("[SkillsLoader] Fetching skills from:", marketplaceUrl);

  try {
    // Fetch skills directory listing
    const response = await fetch(marketplaceUrl, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "LocalDesk"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const contents: GitHubContent[] = await response.json();
    const skills: Skill[] = [];

    // Filter only directories (each skill is a directory)
    const skillDirs = contents.filter(item => item.type === "dir");

    // Fetch SKILL.md for each skill
    for (const dir of skillDirs) {
      try {
        const skillMdUrl = `https://raw.githubusercontent.com/vakovalskii/LocalDesk-Skills/main/${dir.path}/SKILL.md`;
        const skillMdResponse = await fetch(skillMdUrl);

        if (skillMdResponse.ok) {
          const skillMdContent = await skillMdResponse.text();
          const metadata = parseSkillMd(skillMdContent);

          if (metadata) {
            // Determine category from path (e.g., "skills/creative/art" -> "creative")
            const pathParts = dir.path.split("/");
            const category = pathParts.length > 2 ? pathParts[1] : "general";

            skills.push({
              id: metadata.name,
              name: metadata.name,
              description: metadata.description,
              category,
              author: metadata.metadata?.author,
              version: metadata.metadata?.version,
              license: metadata.license,
              compatibility: metadata.compatibility,
              repoPath: dir.path,
              enabled: false
            });
          }
        }
      } catch (error) {
        console.warn(`[SkillsLoader] Failed to fetch skill ${dir.name}:`, error);
      }
    }

    console.log(`[SkillsLoader] Fetched ${skills.length} skills`);

    // Update store with new skills list
    updateSkillsList(skills);

    return skills;
  } catch (error) {
    console.error("[SkillsLoader] Failed to fetch skills:", error);
    throw error;
  }
}

/**
 * Download and cache a skill's full contents
 */
export async function downloadSkill(skillId: string): Promise<string> {
  const settings = loadSkillsSettings();
  const skill = settings.skills.find(s => s.id === skillId);

  if (!skill) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  ensureCacheDir();
  const skillCacheDir = path.join(getCacheDir(), skillId);

  console.log(`[SkillsLoader] Downloading skill: ${skillId}`);

  // Create skill cache directory
  if (!fs.existsSync(skillCacheDir)) {
    fs.mkdirSync(skillCacheDir, { recursive: true });
  }

  // Fetch skill directory contents
  const contentsUrl = `https://api.github.com/repos/vakovalskii/LocalDesk-Skills/contents/${skill.repoPath}`;
  const response = await fetch(contentsUrl, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "LocalDesk"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const contents: GitHubContent[] = await response.json();

  // Download all files recursively
  await downloadContents(contents, skillCacheDir, skill.repoPath);

  return skillCacheDir;
}

async function downloadContents(
  contents: GitHubContent[],
  targetDir: string,
  basePath: string
): Promise<void> {
  for (const item of contents) {
    const localPath = path.join(targetDir, item.name);

    if (item.type === "file" && item.download_url) {
      // Download file
      const response = await fetch(item.download_url);
      const content = await response.text();
      fs.writeFileSync(localPath, content, "utf-8");
    } else if (item.type === "dir") {
      // Create directory and fetch its contents
      if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true });
      }

      const subContentsUrl = `https://api.github.com/repos/vakovalskii/LocalDesk-Skills/contents/${item.path}`;
      const subResponse = await fetch(subContentsUrl, {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "LocalDesk"
        }
      });

      if (subResponse.ok) {
        const subContents: GitHubContent[] = await subResponse.json();
        await downloadContents(subContents, localPath, item.path);
      }
    }
  }
}

/**
 * Get cached skill directory path (or download if not cached)
 */
export async function getSkillPath(skillId: string): Promise<string> {
  const skillCacheDir = path.join(getCacheDir(), skillId);

  // Check if already cached
  if (fs.existsSync(skillCacheDir) && fs.existsSync(path.join(skillCacheDir, "SKILL.md"))) {
    return skillCacheDir;
  }

  // Download and cache
  return downloadSkill(skillId);
}

/**
 * Read skill's SKILL.md content
 */
export async function readSkillContent(skillId: string): Promise<string> {
  const skillPath = await getSkillPath(skillId);
  const skillMdPath = path.join(skillPath, "SKILL.md");

  if (fs.existsSync(skillMdPath)) {
    return fs.readFileSync(skillMdPath, "utf-8");
  }

  throw new Error(`SKILL.md not found for: ${skillId}`);
}

/**
 * List files in a skill directory
 */
export async function listSkillFiles(skillId: string): Promise<string[]> {
  const skillPath = await getSkillPath(skillId);
  const files: string[] = [];

  function walkDir(dir: string, prefix: string = ""): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walkDir(path.join(dir, entry.name), relativePath);
      } else {
        files.push(relativePath);
      }
    }
  }

  walkDir(skillPath);
  return files;
}

/**
 * Read a specific file from a skill
 */
export async function readSkillFile(skillId: string, filePath: string): Promise<string> {
  const skillPath = await getSkillPath(skillId);
  const fullPath = path.join(skillPath, filePath);

  // Security check - prevent path traversal
  if (!fullPath.startsWith(skillPath)) {
    throw new Error("Invalid file path");
  }

  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, "utf-8");
  }

  throw new Error(`File not found: ${filePath}`);
}

/**
 * Clear skills cache
 */
export function clearSkillsCache(): void {
  const cacheDir = getCacheDir();

  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log("[SkillsLoader] Skills cache cleared");
  }
}
