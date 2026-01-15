/**
 * ExtractPageContentTool - Extract full content from web pages using Tavily API
 */

import { tavily } from '@tavily/core';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from './base-tool.js';

export interface ExtractPageParams {
  urls: string[];
  explanation: string;
}

export interface PageContent {
  url: string;
  content: string;
  char_count: number;
  success: boolean;
  error?: string;
}

export const ExtractPageContentToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "ExtractPageContent",
    description: "Extract full detailed content from specific web pages. Use AFTER WebSearch to get complete page content from URLs found in search results. Returns full page content in readable format. Best for deep analysis of specific pages and extracting structured data.",
    parameters: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
          description: "Why extract these specific pages"
        },
        urls: {
          type: "array",
          items: {
            type: "string"
          },
          description: "List of URLs to extract full content from (1-5 URLs)",
          minItems: 1,
          maxItems: 5
        }
      },
      required: ["explanation", "urls"]
    }
  }
};

export class ExtractPageContentTool {
  private tvly: any;

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'dummy-key') {
      throw new Error('Tavily API key not configured. Please set it in Settings.');
    }
    this.tvly = tavily({ apiKey });
  }

  async extract(params: ExtractPageParams): Promise<PageContent[]> {
    const { urls } = params;

    console.log(`[ExtractPage] Extracting ${urls.length} URLs`);

    if (urls.length === 0 || urls.length > 5) {
      throw new Error('Must provide 1-5 URLs to extract');
    }

    try {
      const response = await this.tvly.extract(urls);

      const results: PageContent[] = [];

      // Add successful extractions
      response.results?.forEach((result: any) => {
        results.push({
          url: result.url,
          content: result.rawContent,
          char_count: result.rawContent.length,
          success: true,
        });
      });

      // Add failed extractions
      response.failedResults?.forEach((failed: any) => {
        results.push({
          url: failed.url,
          content: '',
          char_count: 0,
          success: false,
          error: failed.error,
        });
      });

      console.log(`[ExtractPage] Extracted ${results.filter(r => r.success).length}/${urls.length} pages`);
      return results;

    } catch (error) {
      console.error('[ExtractPage] Error:', error);
      throw error;
    }
  }

  formatResults(results: PageContent[], contentLimit: number = 5000): string {
    let formatted = '📄 **Extracted Page Content**\n\n';
    formatted += '**IMPORTANT**: When using information from these pages, ALWAYS cite the source with [Source X] and include the URL.\n\n';

    results.forEach((result, index) => {
      const sourceNum = index + 1;
      formatted += `**[Source ${sourceNum}]** ${result.url}\n`;
      
      if (result.success) {
        const preview = result.content.substring(0, contentLimit);
        formatted += `📊 **Content** (${result.char_count} characters total):\n\n`;
        formatted += `${preview}`;
        if (result.content.length > contentLimit) {
          formatted += `\n\n...[Content truncated. Showing first ${contentLimit} of ${result.char_count} characters]...`;
        }
        formatted += '\n\n';
      } else {
        formatted += `❌ **Extraction Failed**: ${result.error || 'Unknown error'}\n\n`;
      }
      
      formatted += '---\n\n';
    });

    formatted += '**Instructions:**\n';
    formatted += '- Cite sources as [Source 1], [Source 2], etc.\n';
    formatted += '- Include URLs as clickable links: [text](url)\n';
    formatted += '- Always provide source attribution for facts and data\n';

    return formatted;
  }
}

