/**
 * Glob Tool - Search for files by pattern
 */

import { readdirSync } from 'fs';
import { join, relative } from 'path';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from './base-tool.js';

export const GlobToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "search_files",
    description: "Search for files matching a glob pattern. Find files by name or extension.",
    parameters: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
          description: "What files you're looking for and why"
        },
        pattern: {
          type: "string",
          description: "Glob pattern (e.g., '*.ts', 'src/**/*.js')"
        }
      },
      required: ["explanation", "pattern"]
    }
  }
};

const normalizePath = (value: string) => value.replace(/\\/g, '/');

const normalizePattern = (pattern: string) => {
  let normalized = normalizePath(pattern).trim();
  if (normalized.startsWith('./')) normalized = normalized.slice(2);
  if (normalized.startsWith('/')) normalized = normalized.slice(1);
  return normalized;
};

const escapeRegex = (value: string) => value.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');

// Simple glob matching (supports *, ?, and ** on relative paths)
function globToRegExp(pattern: string): RegExp {
  const normalized = normalizePattern(pattern);
  let regex = '^';
  let index = 0;

  while (index < normalized.length) {
    const char = normalized[index];

    if (char === '*') {
      const nextChar = normalized[index + 1];
      if (nextChar === '*') {
        const afterGlobstar = normalized[index + 2];
        if (afterGlobstar === '/') {
          regex += '(?:.*\\/)?';
          index += 3;
        } else {
          regex += '.*';
          index += 2;
        }
      } else {
        regex += '[^/]*';
        index += 1;
      }
      continue;
    }

    if (char === '?') {
      regex += '[^/]';
      index += 1;
      continue;
    }

    regex += escapeRegex(char);
    index += 1;
  }

  regex += '$';
  return new RegExp(regex, 'i');
}

// Recursively search for files matching pattern
function searchFiles(
  dir: string,
  baseDir: string,
  regex: RegExp,
  patternHasSlash: boolean,
  allowRecursive: boolean,
  results: string[] = []
): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (allowRecursive) {
        searchFiles(fullPath, baseDir, regex, patternHasSlash, allowRecursive, results);
      }
      continue;
    }

    if (entry.isFile()) {
      const relPath = normalizePath(relative(baseDir, fullPath));
      const matches = patternHasSlash
        ? regex.test(relPath)
        : regex.test(entry.name) || regex.test(relPath);

      if (matches) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

export async function executeGlobTool(
  args: { pattern: string; explanation: string },
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    if (!context.cwd || !context.cwd.trim()) {
      return {
        success: false,
        error: 'Cannot search files: No workspace folder is set.'
      };
    }

    const normalizedPattern = normalizePattern(args.pattern);
    if (!normalizedPattern) {
      return {
        success: false,
        error: 'Glob pattern is required'
      };
    }

    console.log(`[Glob] Searching for pattern: ${normalizedPattern} in ${context.cwd}`);

    const regex = globToRegExp(normalizedPattern);
    const patternHasSlash = /[\\/]/.test(args.pattern);
    const allowRecursive = normalizedPattern.includes('**');

    const results = searchFiles(context.cwd, context.cwd, regex, patternHasSlash, allowRecursive);
    
    if (results.length === 0) {
      return {
        success: true,
        output: 'No files found'
      };
    }
    
    // Return results with proper encoding (UTF-8)
    const output = results.join('\n');
    console.log(`[Glob] Found ${results.length} files`);
    
    return {
      success: true,
      output
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Glob search failed: ${error.message || String(error)}`
    };
  }
}
