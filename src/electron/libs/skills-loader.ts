import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { Skill, SkillMetadata, loadSkillsSettings, updateSkillsList } from "./skills-store.js";

const SKILLS_CACHE_DIR = "skills-cache";

interface GitHubContent {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url?: string;
  url: string;
}

function getCacheDir(): string {
  return path.join(app.getPath("userData"), SKILLS_CACHE_DIR);
}

function ensureCacheDir(): void {
  const cacheDir = getCacheDir();
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

// Cache for parsed marketplace URLs
interface ParsedMarketplaceUrl {
  baseUrl: string;
  repo: string;
  branch: string;
  isGitHub: boolean;
}

const marketplaceUrlCache = new Map<string, ParsedMarketplaceUrl>();

/**
 * Parse marketplace URL to extract base URL, repo, and branch
 * Supports any URL format, not just GitHub API
 * 
 * Examples:
* - https://api.github.com/repos/vakovalskii/LocalDesk-Skills/contents/skills
 * - https://api.github.com/repos/vakovalskii/LocalDesk-Skills/contents/skills?ref=feature/rlm-pdf-reader
 * - https://gitlab.com/api/v4/projects/123/repository/tree?ref=main
 * - https://custom-api.example.com/skills
 * - http://localhost:3000/api/skills
 * - http://127.0.0.1:8080/skills?ref=dev
 * 
 * Returns: { baseUrl, repo, branch, isGitHub }
 */
function parseMarketplaceUrl(url: string): ParsedMarketplaceUrl {
  // Check cache first
  if (marketplaceUrlCache.has(url)) {
    return marketplaceUrlCache.get(url)!;
  }
  
  try {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    const branch = urlObj.searchParams.get("ref") || "main";
    
    // Try to extract repo from GitHub API format: /repos/{owner}/{repo}/contents
    const githubMatch = url.match(/\/repos\/([^/]+\/[^/]+)\/contents/);
    if (githubMatch) {
      const repo = githubMatch[1];
      const result: ParsedMarketplaceUrl = {
        baseUrl,
        repo,
        branch,
        isGitHub: true
      };
      marketplaceUrlCache.set(url, result);
      return result;
    }
    
    // For non-GitHub URLs, try to extract repo from path
    // Generic format: /{owner}/{repo}/... or just use the path
    const pathParts = urlObj.pathname.split("/").filter(p => p);
    let repo = "";
    
    if (pathParts.length >= 2) {
      // Try to find owner/repo pattern
      repo = `${pathParts[0]}/${pathParts[1]}`;
    } else if (pathParts.length === 1) {
      repo = pathParts[0];
    } else {
      // Fallback: use hostname as repo identifier
      repo = urlObj.hostname;
    }
    
    const result: ParsedMarketplaceUrl = {
      baseUrl,
      repo,
      branch,
      isGitHub: false
    };
    marketplaceUrlCache.set(url, result);
    return result;
  } catch (error) {
    console.error("[SkillsLoader] Failed to parse marketplace URL:", error);
    // Fallback to default GitHub
    const fallback: ParsedMarketplaceUrl = {
      baseUrl: "https://api.github.com",
      repo: "vakovalskii/LocalDesk-Skills",
      branch: "main",
      isGitHub: true
    };
    marketplaceUrlCache.set(url, fallback);
    return fallback;
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
  
  // Parse marketplace URL to get base URL, repo, and branch
  const parsed = parseMarketplaceUrl(marketplaceUrl);
  console.log(`[SkillsLoader] Using baseUrl: ${parsed.baseUrl}, repo: ${parsed.repo}, branch: ${parsed.branch}, isGitHub: ${parsed.isGitHub}`);
  
  try {
    // Fetch skills directory listing using the marketplace URL directly
    const response = await fetch(marketplaceUrl, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "LocalDesk"
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const contents: GitHubContent[] = await response.json();
    const skills: Skill[] = [];
    
    // Filter only directories (each skill is a directory)
    const skillDirs = contents.filter(item => item.type === "dir");
    
    // Fetch SKILL.md for each skill
    for (const dir of skillDirs) {
      try {
        // Build SKILL.md URL based on source type
        let skillMdUrl: string;
        if (parsed.isGitHub) {
          // For GitHub, use raw.githubusercontent.com
          skillMdUrl = `https://raw.githubusercontent.com/${parsed.repo}/${parsed.branch}/${dir.path}/SKILL.md`;
        } else if (dir.download_url) {
          // For other sources, try to use download_url from API response
          // Append SKILL.md to the directory path (don't replace the directory name)
          const dirUrl = new URL(dir.download_url);
          // dir.download_url points to the directory, append SKILL.md to it
          // Preserve query parameters and hash from original download_url
          skillMdUrl = `${dirUrl.origin}${dirUrl.pathname.replace(/\/$/, "")}/SKILL.md${dirUrl.search}${dirUrl.hash}`;
        } else {
          // Fallback: construct URL from marketplace URL base
          // For localhost and custom APIs, use the marketplace URL as base and append skill path
          const marketplaceUrlObj = new URL(marketplaceUrl);
          const marketplaceBasePath = marketplaceUrlObj.pathname.replace(/\/$/, ""); // Remove trailing slash
          const marketplaceSegments = marketplaceBasePath.split("/").filter(p => p);
          const dirPathSegments = dir.path.split("/").filter(p => p);
          // Only add ref parameter if the original marketplace URL had it (indicates API supports it)
          const hasRefParam = marketplaceUrlObj.searchParams.has("ref");
          const refParam = hasRefParam ? `?ref=${parsed.branch}` : "";
          
          // Remove common prefix between marketplace path and dir path
          // Handle three cases:
          // 1. dir.path starts with all marketplace segments (e.g., "api/skills/my-skill" for marketplace "/api/skills")
          // 2. dir.path starts with last marketplace segment (e.g., "skills/my-skill" for marketplace "/api/skills")
          // 3. dir.path exactly matches marketplace endpoint (e.g., "skills" for marketplace "/skills")
          let relativePath = dir.path;
          
          if (marketplaceSegments.length > 0 && dirPathSegments.length >= marketplaceSegments.length) {
            // Check if dir.path starts with all marketplace segments
            let matchesAllSegments = true;
            for (let i = 0; i < marketplaceSegments.length; i++) {
              if (dirPathSegments[i] !== marketplaceSegments[i]) {
                matchesAllSegments = false;
                break;
              }
            }
            
            if (matchesAllSegments) {
              // Remove all matching segments
              relativePath = dirPathSegments.slice(marketplaceSegments.length).join("/");
            } else if (dirPathSegments.length > 0 && dirPathSegments[0] === marketplaceSegments[marketplaceSegments.length - 1]) {
              // dir path starts with the last marketplace segment, remove it
              relativePath = dirPathSegments.slice(1).join("/");
            }
          } else if (marketplaceSegments.length > 0 && dirPathSegments.length > 0) {
            // Check if dir.path starts with last marketplace segment or matches exactly
            const lastMarketplaceSegment = marketplaceSegments[marketplaceSegments.length - 1];
            if (dirPathSegments[0] === lastMarketplaceSegment) {
              relativePath = dirPathSegments.slice(1).join("/");
            } else if (dirPathSegments.length === marketplaceSegments.length) {
              // Check if dir.path exactly matches marketplace (e.g., "skills" matches "/skills")
              let matchesExactly = true;
              for (let i = 0; i < dirPathSegments.length; i++) {
                if (dirPathSegments[i] !== marketplaceSegments[i]) {
                  matchesExactly = false;
                  break;
                }
              }
              if (matchesExactly) {
                relativePath = "";
              }
            }
          } else if (marketplaceSegments.length > 0 && dirPathSegments.length === 0) {
            // Empty dir.path, use empty relative path
            relativePath = "";
          }
          
          // If relativePath is empty, it means the path matches exactly - use empty string
          // This will create URL like /api/skills/SKILL.md instead of /api/skills/skills/SKILL.md
          // Handle empty marketplaceBasePath (root path) to avoid double slashes
          if (marketplaceBasePath === "") {
            // Root path: http://localhost:3000/
            skillMdUrl = relativePath
              ? `${parsed.baseUrl}/${relativePath}/SKILL.md${refParam}`
              : `${parsed.baseUrl}/SKILL.md${refParam}`;
          } else {
            // Non-root path: http://localhost:3000/api/skills
            skillMdUrl = relativePath
              ? `${parsed.baseUrl}${marketplaceBasePath}/${relativePath}/SKILL.md${refParam}`
              : `${parsed.baseUrl}${marketplaceBasePath}/SKILL.md${refParam}`;
          }
        }
        
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
  
  // Parse marketplace URL to get base URL, repo, and branch
  const parsed = parseMarketplaceUrl(settings.marketplaceUrl);
  
  ensureCacheDir();
  const skillCacheDir = path.join(getCacheDir(), skillId);
  
  console.log(`[SkillsLoader] Downloading skill: ${skillId} from ${parsed.repo}/${parsed.branch}`);
  
  // Create skill cache directory
  if (!fs.existsSync(skillCacheDir)) {
    fs.mkdirSync(skillCacheDir, { recursive: true });
  }
  
  // Build contents URL based on source type
  let contentsUrl: string;
  if (parsed.isGitHub) {
    // For GitHub, use GitHub API format
    contentsUrl = `${parsed.baseUrl}/repos/${parsed.repo}/contents/${skill.repoPath}?ref=${parsed.branch}`;
  } else {
    // For other sources, construct URL by appending skill path to marketplace base
    // skill.repoPath is a full path from repo root (e.g., "skills/skill-name")
    // We need to extract the relative part relative to marketplace endpoint
    const marketplaceUrlObj = new URL(settings.marketplaceUrl);
    const marketplaceBasePath = marketplaceUrlObj.pathname.replace(/\/$/, "");
    const marketplaceSegments = marketplaceBasePath.split("/").filter(p => p);
    const skillPathSegments = skill.repoPath.split("/").filter(p => p);
    // Only add ref parameter if the original marketplace URL had it (indicates API supports it)
    const hasRefParam = marketplaceUrlObj.searchParams.has("ref");
    const refParam = hasRefParam ? `?ref=${parsed.branch}` : "";
    
    // Remove common prefix between marketplace path and skill path
    // Handle three cases:
    // 1. skill.repoPath starts with all marketplace segments (e.g., "api/skills/skill-name" for marketplace "/api/skills")
    // 2. skill.repoPath starts with last marketplace segment (e.g., "skills/skill-name" for marketplace "/api/skills")
    // 3. skill.repoPath exactly matches marketplace endpoint (e.g., "skills" for marketplace "/skills")
    let relativePath = skill.repoPath;
    
    if (marketplaceSegments.length > 0 && skillPathSegments.length >= marketplaceSegments.length) {
      // Check if skill.repoPath starts with all marketplace segments
      let matchesAllSegments = true;
      for (let i = 0; i < marketplaceSegments.length; i++) {
        if (skillPathSegments[i] !== marketplaceSegments[i]) {
          matchesAllSegments = false;
          break;
        }
      }
      
      if (matchesAllSegments) {
        // Remove all matching segments
        relativePath = skillPathSegments.slice(marketplaceSegments.length).join("/");
      } else if (skillPathSegments.length > 0 && skillPathSegments[0] === marketplaceSegments[marketplaceSegments.length - 1]) {
        // skill path starts with the last marketplace segment, remove it
        relativePath = skillPathSegments.slice(1).join("/");
      }
    } else if (marketplaceSegments.length > 0 && skillPathSegments.length > 0) {
      // Check if skill.repoPath starts with last marketplace segment or matches exactly
      const lastMarketplaceSegment = marketplaceSegments[marketplaceSegments.length - 1];
      if (skillPathSegments[0] === lastMarketplaceSegment) {
        relativePath = skillPathSegments.slice(1).join("/");
      } else if (skillPathSegments.length === marketplaceSegments.length) {
        // Check if skill.repoPath exactly matches marketplace (e.g., "skills" matches "/skills")
        let matchesExactly = true;
        for (let i = 0; i < skillPathSegments.length; i++) {
          if (skillPathSegments[i] !== marketplaceSegments[i]) {
            matchesExactly = false;
            break;
          }
        }
        if (matchesExactly) {
          relativePath = "";
        }
      }
    } else if (marketplaceSegments.length > 0 && skillPathSegments.length === 0) {
      // Empty skill.repoPath, use empty relative path
      relativePath = "";
    }
    
    // If relativePath is empty, it means the path matches exactly - use empty string
    // Handle empty marketplaceBasePath (root path) to avoid double slashes
    if (marketplaceBasePath === "") {
      // Root path: http://localhost:3000/
      contentsUrl = relativePath
        ? `${parsed.baseUrl}/${relativePath}${refParam}`
        : `${parsed.baseUrl}${refParam}`;
    } else {
      // Non-root path: http://localhost:3000/api/skills
      contentsUrl = relativePath
        ? `${parsed.baseUrl}${marketplaceBasePath}/${relativePath}${refParam}`
        : `${parsed.baseUrl}${marketplaceBasePath}${refParam}`;
    }
  }
  
  const response = await fetch(contentsUrl, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "LocalDesk"
    }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const contents: GitHubContent[] = await response.json();
  
  // Download all files recursively
  const errors = await downloadContents(contents, skillCacheDir, skill.repoPath, parsed, settings.marketplaceUrl);
  
  // Check if SKILL.md was downloaded (critical file)
  const skillMdPath = path.join(skillCacheDir, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`Failed to download skill ${skillId}: SKILL.md not found. This is a critical file.`);
  }
  
  // Report errors if any files failed to download
  if (errors.length > 0) {
    console.warn(`[SkillsLoader] Skill ${skillId} downloaded with ${errors.length} error(s):`);
    errors.forEach(err => console.warn(`  - ${err}`));
    // Don't throw - allow partial downloads, but log warnings
    // The skill may still be usable if critical files (like SKILL.md) are present
  }
  
  return skillCacheDir;
}

async function downloadContents(
  contents: GitHubContent[],
  targetDir: string,
  basePath: string,
  parsed: ParsedMarketplaceUrl,
  marketplaceUrl: string
): Promise<string[]> {
  const errors: string[] = [];
  
  for (const item of contents) {
    const localPath = path.join(targetDir, item.name);
    
    if (item.type === "file" && item.download_url) {
      // Download file using download_url from API response
      try {
        const response = await fetch(item.download_url);
        if (!response.ok) {
          const errorMsg = `Failed to download file ${item.name} (${item.path}): ${response.status} ${response.statusText}`;
          console.warn(`[SkillsLoader] ${errorMsg}`);
          errors.push(errorMsg);
          continue; // Skip this file and continue with others
        }
        const content = await response.text();
        fs.writeFileSync(localPath, content, "utf-8");
      } catch (error: unknown) {
        const errorMsg = `Failed to download file ${item.name} (${item.path}): ${error instanceof Error ? error.message : String(error)}`;
        console.warn(`[SkillsLoader] ${errorMsg}`);
        errors.push(errorMsg);
        continue; // Skip this file and continue with others
      }
    } else if (item.type === "dir") {
      // Create directory and fetch its contents
      if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true });
      }
      
      // Build sub-contents URL based on source type
      let subContentsUrl: string;
      if (parsed.isGitHub) {
        // For GitHub, use GitHub API format
        subContentsUrl = `${parsed.baseUrl}/repos/${parsed.repo}/contents/${item.path}?ref=${parsed.branch}`;
      } else {
        // For other sources (including localhost), construct from marketplace URL base
        // item.path from API is a full path from repository root (e.g., "skills/skill-name/subdir")
        // We need to extract the relative part relative to marketplace endpoint
        
        const marketplaceUrlObj = new URL(marketplaceUrl);
        const marketplaceBasePath = marketplaceUrlObj.pathname.replace(/\/$/, ""); // Remove trailing slash
        const marketplaceSegments = marketplaceBasePath.split("/").filter(p => p);
        const itemPathSegments = item.path.split("/").filter(p => p);
        // Only add ref parameter if the original marketplace URL had it (indicates API supports it)
        const hasRefParam = marketplaceUrlObj.searchParams.has("ref");
        const refParam = hasRefParam ? `?ref=${parsed.branch}` : "";
        
        // Remove common prefix between marketplace path and item path
        // Handle three cases:
        // 1. item.path starts with all marketplace segments (e.g., "api/skills/skill-name/subdir" for marketplace "/api/skills")
        // 2. item.path starts with last marketplace segment (e.g., "skills/skill-name/subdir" for marketplace "/api/skills")
        // 3. item.path exactly matches marketplace endpoint (e.g., "skills" for marketplace "/skills")
        let relativePath = item.path;
        
        if (marketplaceSegments.length > 0 && itemPathSegments.length >= marketplaceSegments.length) {
          // Check if item.path starts with all marketplace segments
          let matchesAllSegments = true;
          for (let i = 0; i < marketplaceSegments.length; i++) {
            if (itemPathSegments[i] !== marketplaceSegments[i]) {
              matchesAllSegments = false;
              break;
            }
          }
          
          if (matchesAllSegments) {
            // Remove all matching segments
            relativePath = itemPathSegments.slice(marketplaceSegments.length).join("/");
          } else if (itemPathSegments.length > 0 && itemPathSegments[0] === marketplaceSegments[marketplaceSegments.length - 1]) {
            // item path starts with the last marketplace segment, remove it
            relativePath = itemPathSegments.slice(1).join("/");
          }
        } else if (marketplaceSegments.length > 0 && itemPathSegments.length > 0) {
          // Check if item.path starts with last marketplace segment or matches exactly
          const lastMarketplaceSegment = marketplaceSegments[marketplaceSegments.length - 1];
          if (itemPathSegments[0] === lastMarketplaceSegment) {
            relativePath = itemPathSegments.slice(1).join("/");
          } else if (itemPathSegments.length === marketplaceSegments.length) {
            // Check if item.path exactly matches marketplace (e.g., "skills" matches "/skills")
            let matchesExactly = true;
            for (let i = 0; i < itemPathSegments.length; i++) {
              if (itemPathSegments[i] !== marketplaceSegments[i]) {
                matchesExactly = false;
                break;
              }
            }
            if (matchesExactly) {
              relativePath = "";
            }
          }
        } else if (marketplaceSegments.length > 0 && itemPathSegments.length === 0) {
          // Empty item.path, use empty relative path
          relativePath = "";
        }
        
        // If relativePath is empty, it means the path matches exactly - use empty string
        // Handle empty marketplaceBasePath (root path) to avoid double slashes
        if (marketplaceBasePath === "") {
          // Root path: http://localhost:3000/
          subContentsUrl = relativePath
            ? `${parsed.baseUrl}/${relativePath}${refParam}`
            : `${parsed.baseUrl}${refParam}`;
        } else {
          // Non-root path: http://localhost:3000/api/skills
          subContentsUrl = relativePath
            ? `${parsed.baseUrl}${marketplaceBasePath}/${relativePath}${refParam}`
            : `${parsed.baseUrl}${marketplaceBasePath}${refParam}`;
        }
      }
      
      try {
        const subResponse = await fetch(subContentsUrl, {
          headers: {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "LocalDesk"
          }
        });
        
        if (subResponse.ok) {
          const subContents: GitHubContent[] = await subResponse.json();
          const subErrors = await downloadContents(subContents, localPath, item.path, parsed, marketplaceUrl);
          errors.push(...subErrors);
        } else {
          const errorMsg = `Failed to fetch directory ${item.name} (${item.path}): ${subResponse.status} ${subResponse.statusText}`;
          console.warn(`[SkillsLoader] ${errorMsg}`);
          errors.push(errorMsg);
        }
      } catch (error: unknown) {
        const errorMsg = `Failed to fetch directory ${item.name} (${item.path}): ${error instanceof Error ? error.message : String(error)}`;
        console.warn(`[SkillsLoader] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
  }
  
  return errors;
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
