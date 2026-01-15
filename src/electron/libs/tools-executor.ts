/**
 * Tool executors - actual implementation of each tool
 */

import { resolve, relative, isAbsolute, normalize, sep } from 'path';
import { realpathSync, existsSync } from 'fs';
import type { ToolResult, ToolExecutionContext } from './tools/base-tool.js';
import type { ApiSettings } from '../types.js';

// Import tool executors
import { executeBashTool } from './tools/bash-tool.js';
import { executeReadTool } from './tools/read-tool.js';
import { executeWriteTool } from './tools/write-tool.js';
import { executeEditTool } from './tools/edit-tool.js';
import { executeGlobTool } from './tools/glob-tool.js';
import { executeGrepTool } from './tools/grep-tool.js';
import { WebSearchTool } from './tools/web-search.js';
import { ExtractPageContentTool } from './tools/extract-page-content.js';
import { executeMemoryTool } from './tools/memory-tool.js';
import { executeJSTool } from './tools/execute-js-tool.js';
import { installPackageTool } from './tools/install-package-tool.js';

export { ToolResult };

export class ToolExecutor {
  private cwd: string;
  private apiSettings: ApiSettings | null;
  private webSearchTool: WebSearchTool | null = null;
  private extractPageTool: ExtractPageContentTool | null = null;

  constructor(cwd: string, apiSettings: ApiSettings | null = null) {
    // Normalize and resolve the working directory to absolute path
    // If cwd is empty or undefined, keep it empty (no workspace mode)
    this.cwd = cwd && cwd.trim() ? normalize(resolve(cwd)) : '';
    this.apiSettings = apiSettings;
    
    // Initialize web tools if Tavily API key is available
    if (apiSettings?.tavilyApiKey) {
      this.webSearchTool = new WebSearchTool(apiSettings.tavilyApiKey);
      this.extractPageTool = new ExtractPageContentTool(apiSettings.tavilyApiKey);
    }
  }

  // Security: Check if path is within allowed directory (enhanced protection)
  private isPathSafe(filePath: string): boolean {
    try {
      // Normalize input path to prevent path traversal tricks
      const normalizedInput = normalize(filePath);
      
      // Resolve to absolute path relative to cwd
      const absolutePath = resolve(this.cwd, normalizedInput);
      
      // If path exists, get real path (resolves symlinks)
      // This prevents symlink attacks
      let realPath = absolutePath;
      if (existsSync(absolutePath)) {
        try {
          realPath = realpathSync(absolutePath);
        } catch {
          // If realpath fails, use absolute path
          realPath = absolutePath;
        }
      }
      
      // Normalize the real path
      const normalizedRealPath = normalize(realPath);
      const normalizedCwd = normalize(this.cwd);
      
      // Check if the path is within cwd using string comparison
      // Add separator to prevent partial matches (e.g., /app vs /app-data)
      const cwdWithSep = normalizedCwd.endsWith(sep) ? normalizedCwd : normalizedCwd + sep;
      const isInside = normalizedRealPath === normalizedCwd || normalizedRealPath.startsWith(cwdWithSep);
      
      if (!isInside) {
        console.warn(`[Security] Blocked access to path outside working directory:`);
        console.warn(`  Requested: ${filePath}`);
        console.warn(`  Resolved: ${normalizedRealPath}`);
        console.warn(`  Working dir: ${normalizedCwd}`);
      }
      
      return isInside;
    } catch (error) {
      console.error(`[Security] Error checking path safety: ${error}`);
      return false;
    }
  }

  private getContext(): ToolExecutionContext {
    return {
      cwd: this.cwd,
      isPathSafe: this.isPathSafe.bind(this)
    };
  }

  async executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    console.log(`[Tool Executor] Executing ${toolName}`, args);

    const context = this.getContext();

    // Check if cwd is valid for file operations
    const fileOperationTools = ['Write', 'Edit', 'Bash', 'Read', 'ExecuteJS', 'InstallPackage'];
    if (fileOperationTools.includes(toolName)) {
      if (!this.cwd || this.cwd === '.' || this.cwd === '') {
        return {
          success: false,
          error: `❌ Cannot perform file operations without a workspace folder.\n\n` +
                 `📁 To enable file access:\n` +
                 `1. Click "+ New Chat" in the sidebar\n` +
                 `2. Choose a workspace folder using the "Browse..." button\n` +
                 `3. Start a new chat session\n\n` +
                 `💬 You can continue chatting without file access, but I won't be able to read, write, or edit files.`
        };
      }
    }

    try {
      switch (toolName) {
        case 'Bash':
          return await executeBashTool(args as any, context);
        
        case 'Read':
          return await executeReadTool(args as any, context);
        
        case 'Write':
          return await executeWriteTool(args as any, context);
        
        case 'Edit':
          return await executeEditTool(args as any, context);
        
        case 'Glob':
          return await executeGlobTool(args as any, context);
        
        case 'Grep':
          return await executeGrepTool(args as any, context);
        
        case 'WebSearch':
          return await this.executeWebSearch(args);
        
        case 'ExtractPageContent':
          return await this.executeExtractPage(args);
        
        case 'Memory':
          return await executeMemoryTool(args as any, context);
        
        case 'ExecuteJS':
          return await executeJSTool(args as any, context);
        
        case 'InstallPackage':
          return await installPackageTool(args as any, context);
        
        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`
          };
      }
    } catch (error) {
      console.error(`[Tool Executor] Error in ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async executeWebSearch(args: any): Promise<ToolResult> {
    if (!this.webSearchTool) {
      return {
        success: false,
        error: 'Web search is not available. Please configure Tavily API key in Settings.'
      };
    }

    try {
      const results = await this.webSearchTool.search({
        query: args.query,
        explanation: args.explanation,
        max_results: args.max_results || 5
      });

      const formatted = this.webSearchTool.formatResults(results);
      
      return {
        success: true,
        output: formatted
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Web search failed: ${error.message}`
      };
    }
  }

  private async executeExtractPage(args: any): Promise<ToolResult> {
    if (!this.extractPageTool) {
      return {
        success: false,
        error: 'Page extraction is not available. Please configure Tavily API key in Settings.'
      };
    }

    try {
      const results = await this.extractPageTool.extract({
        urls: args.urls,
        explanation: args.explanation
      });

      const formatted = this.extractPageTool.formatResults(results);
      
      return {
        success: true,
        output: formatted
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Page extraction failed: ${error.message}`
      };
    }
  }
}
