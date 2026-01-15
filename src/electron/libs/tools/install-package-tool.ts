/**
 * InstallPackage Tool - Install npm packages for use in ExecuteJS sandbox
 */

import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from './base-tool.js';

export const InstallPackageToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "InstallPackage",
    description: "Install npm packages into the sandbox environment for use with ExecuteJS. Packages are installed into a session-specific node_modules directory and can be used with require() in ExecuteJS code. Safe for any package - sandbox is isolated.",
    parameters: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
          description: "Why you need this package and what it will be used for"
        },
        packages: {
          type: "array",
          items: { type: "string" },
          description: "Array of npm package names to install. Can include version (e.g., 'lodash@4.17.21' or just 'lodash' for latest)"
        }
      },
      required: ["explanation", "packages"]
    }
  }
};

export async function installPackageTool(
  args: { packages: string[]; explanation: string },
  context: ToolExecutionContext
): Promise<ToolResult> {
  if (!context.cwd || context.cwd === '') {
    return {
      success: false,
      error: `Cannot install packages: No workspace folder is set. Please start a new chat with a valid workspace folder.`
    };
  }

  try {
    // Create sandbox node_modules directory in workspace
    const sandboxDir = join(context.cwd, '.cowork-sandbox');
    const nodeModulesDir = join(sandboxDir, 'node_modules');
    
    if (!existsSync(sandboxDir)) {
      mkdirSync(sandboxDir, { recursive: true });
    }

    // Create package.json if it doesn't exist
    const packageJsonPath = join(sandboxDir, 'package.json');
    if (!existsSync(packageJsonPath)) {
      const packageJson = {
        name: "cowork-sandbox",
        version: "1.0.0",
        description: "Isolated sandbox for LLM code execution",
        private: true
      };
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }

    console.log(`[InstallPackage] Installing packages: ${args.packages.join(', ')}`);
    console.log(`[InstallPackage] Target directory: ${sandboxDir}`);

    // Pin known problematic packages to working versions
    const packageVersions = args.packages.map(pkg => {
      const pkgName = pkg.split('@')[0];
      // pdf-parse v2.x has breaking changes, use stable v1.1.1
      if (pkgName === 'pdf-parse' && !pkg.includes('@')) {
        return 'pdf-parse@1.1.1';
      }
      return pkg;
    });

    // Install packages using npm
    const packagesStr = packageVersions.join(' ');
    const command = `npm install --prefix "${sandboxDir}" ${packagesStr} --no-save --loglevel=error`;
    
    const startTime = Date.now();
    execSync(command, {
      cwd: sandboxDir,
      stdio: 'pipe',
      timeout: 120000, // 2 minutes timeout
      env: { ...process.env, NODE_ENV: 'production' }
    });
    const duration = Date.now() - startTime;

    console.log(`[InstallPackage] Installation completed in ${duration}ms`);

    return {
      success: true,
      output: `✅ Successfully installed packages: ${args.packages.join(', ')}\n\nInstallation took ${duration}ms\n\nYou can now use these packages in ExecuteJS with require():\n\n\`\`\`javascript\nconst lodash = require('lodash');\n// use the package...\n\`\`\``
    };

  } catch (error: any) {
    console.error('[InstallPackage] Error:', error);
    return {
      success: false,
      error: `Failed to install packages: ${error.message}\n\nMake sure the package names are correct and npm is available.`
    };
  }
}
