/**
 * Glob Tool - Search for files by pattern
 */

import { readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from './base-tool.js';

export const GlobToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "Glob",
    description: "Search for files matching a pattern. Use this to find files by name or extension.",
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

// Simple glob matching (supports * and **)
function matchPattern(filename: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/\\\\]*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(filename);
}

// Recursively search for files matching pattern
function searchFiles(dir: string, pattern: string, results: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories if pattern contains **
        if (pattern.includes('**')) {
          searchFiles(fullPath, pattern, results);
        }
      } else if (entry.isFile()) {
        // Check if file matches pattern
        if (matchPattern(entry.name, pattern) || matchPattern(fullPath, pattern)) {
          results.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Skip directories we can't access
  }
  
  return results;
}

export async function executeGlobTool(
  args: { pattern: string; explanation: string },
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    console.log(`[Glob] Searching for pattern: ${args.pattern} in ${context.cwd}`);
    
    const results = searchFiles(context.cwd, args.pattern);
    
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
      error: `Glob search failed: ${error.message}`
    };
  }
}

