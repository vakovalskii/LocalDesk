/**
 * ExecuteJS Tool - Execute JavaScript code with dynamic require support
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { createRequire } from 'module';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from './base-tool.js';

export const ExecuteJSToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "ExecuteJS",
    description: "Execute JavaScript code in a sandboxed environment. Use for data processing, calculations, file operations. Can use require() for built-in Node modules and npm packages installed via InstallPackage tool.",
    parameters: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
          description: "Why you're executing this code and what it should do"
        },
        code: {
          type: "string",
          description: "JavaScript code to execute. Built-in APIs: fs (readFile, writeFile, exists, listDir), path (join, resolve), console, JSON, Math, Date, __dirname. Can require(): built-in modules (fs, path, crypto, util, url, etc.) and npm packages installed with InstallPackage. IMPORTANT: Use explicit 'return' statement to return values. Example: const data = fs.readFile('file.txt'); return { success: true };"
        },
        timeout: {
          type: "number",
          description: "Execution timeout in milliseconds (default: 5000, max: 30000)",
          minimum: 100,
          maximum: 30000
        }
      },
      required: ["explanation", "code"]
    }
  }
};

export async function executeJSTool(
  args: { code: string; explanation: string; timeout?: number },
  context: ToolExecutionContext
): Promise<ToolResult> {
  const timeout = Math.min(args.timeout || 5000, 30000);
  
  try {
    console.log('[ExecuteJS] Starting execution');
    console.log('[ExecuteJS] Timeout:', timeout);
    console.log('[ExecuteJS] Context CWD:', context.cwd);
    console.log('[ExecuteJS] Code length:', args.code.length);
    
    // Prepare sandbox node_modules path
    const sandboxNodeModules = join(context.cwd, '.cowork-sandbox', 'node_modules');
    
    // Create custom require for sandbox modules
    const customRequire = existsSync(sandboxNodeModules) 
      ? createRequire(join(sandboxNodeModules, 'package.json'))
      : require;
    
    // Execute code with access to require
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('require', '__dirname', 'console', args.code);
    
    const output: string[] = [];
    const customConsole = {
      log: (...args: any[]) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
        output.push(msg);
        console.log('[Sandbox]', msg);
      },
      error: (...args: any[]) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
        output.push(`ERROR: ${msg}`);
        console.error('[Sandbox]', msg);
      },
      warn: (...args: any[]) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
        output.push(`WARN: ${msg}`);
        console.warn('[Sandbox]', msg);
      },
    };
    
    // Run with timeout
    const result = await Promise.race([
      fn(customRequire, context.cwd, customConsole),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timeout')), timeout))
    ]);
    
    let responseOutput = '✅ Code executed successfully\n\n';
    
    if (output.length > 0) {
      responseOutput += '**Console Output:**\n```\n' + output.join('\n') + '\n```\n\n';
    }
    
    if (result !== undefined) {
      responseOutput += '**Result:**\n```json\n' + JSON.stringify(result, null, 2) + '\n```';
    }
    
    return {
      success: true,
      output: responseOutput
    };
    
  } catch (error: any) {
    console.error('[ExecuteJS] Error:', error);
    console.error('[ExecuteJS] Code that failed:', args.code);
    
    // Provide helpful error message with code snippet
    let errorMsg = `❌ Execution failed: ${error.message}\n\n`;
    
    // Show more code for syntax errors
    const maxCodeLength = error.message.includes('Unexpected token') ? 800 : 500;
    errorMsg += `**Your code:**\n\`\`\`javascript\n${args.code.substring(0, maxCodeLength)}${args.code.length > maxCodeLength ? '\n// ... truncated ...' : ''}\n\`\`\`\n\n`;
    
    // Add specific hints for common errors
    if (error.message.includes('Unexpected token')) {
      errorMsg += `💡 **Hint**: Syntax error. Check:\n`;
      errorMsg += `- Unclosed parentheses, brackets, or braces\n`;
      errorMsg += `- Missing 'return' statement before async operations\n`;
      errorMsg += `- Incorrect use of arrow functions or promises\n`;
      errorMsg += `- Try breaking complex code into smaller ExecuteJS calls\n`;
    } else if (error.message.includes('is not a function')) {
      const match = error.message.match(/(\w+) is not a function/);
      if (match) {
        errorMsg += `💡 **Hint**: \`${match[1]}\` is not a function. Check:\n`;
        errorMsg += `- Variable name (pdf-parse exports default as function: \`const pdf = require('pdf-parse')\`)\n`;
        errorMsg += `- Module installed correctly (use InstallPackage first)\n`;
        errorMsg += `- Typos in function/variable names\n`;
      }
    } else if (error.message.includes('Cannot find module')) {
      errorMsg += `💡 **Hint**: Module not found. Use InstallPackage(['module-name']) before require().\n`;
    } else if (error.message.includes('cb') && error.message.includes('function')) {
      errorMsg += `💡 **Hint**: Use SYNC methods (fs.readFileSync, not fs.readFile).\n`;
    } else if (error.message.includes('ENOENT')) {
      errorMsg += `💡 **Hint**: File not found. Use path.join(__dirname, 'filename') to get correct path.\n`;
    }
    
    return {
      success: false,
      error: errorMsg
    };
  }
}
