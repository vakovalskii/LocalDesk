/**
 * ExtractPageContentTool - Extract full content from web pages using Tavily API
 * Note: Z.AI does not currently support page extraction, only web search
 */

import { tavily } from '@tavily/core';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from './base-tool.js';
import type { WebSearchProvider } from '../../types.js';
import { webCache } from '../web-cache.js';

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
    name: "extract_page",
    description: "Extract full content from web pages. Use AFTER search_web to get complete page content from URLs. Returns full page content in readable format. Only available with Tavily provider.",
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
  private provider: WebSearchProvider;

  constructor(apiKey: string, provider: WebSearchProvider = 'tavily') {
    this.provider = provider;

    // Page extraction is only available with Tavily
    if (provider !== 'tavily') {
      throw new Error('Page extraction is only available when using Tavily as the web search provider. Please switch to Tavily in Settings or use the web search results directly.');
    }

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

    // Check cache for each URL
    const cachedResults: PageContent[] = [];
    const urlsToFetch: string[] = [];

    for (const url of urls) {
      const cacheKey = `extract:tavily:${url}`;
      const cached = await webCache.get(cacheKey);
      if (cached && typeof cached === 'object' && 'content' in cached) {
        console.log(`[ExtractPage] Cache hit for URL: ${url}`);
        cachedResults.push(cached as PageContent);
      } else {
        urlsToFetch.push(url);
      }
    }

    // If all URLs were cached, return early
    if (urlsToFetch.length === 0) {
      return cachedResults;
    }

    // Fetch uncached URLs
    try {
      const response = await this.tvly.extract(urlsToFetch);

      const results: PageContent[] = [...cachedResults];

      // Add successful extractions
      response.results?.forEach((result: any) => {
        const pageResult: PageContent = {
          url: result.url,
          content: result.rawContent,
          char_count: result.rawContent.length,
          success: true,
        };
        results.push(pageResult);

        // Cache the result (TTL: 10 minutes)
        const cacheKey = `extract:tavily:${result.url}`;
        webCache.set(cacheKey, pageResult, 10 * 60 * 1000);
      });

      // Add failed extractions
      response.failedResults?.forEach((failed: any) => {
        const pageResult: PageContent = {
          url: failed.url,
          content: '',
          char_count: 0,
          success: false,
          error: failed.error,
        };
        results.push(pageResult);

        // Cache failures too (shorter TTL: 1 minute)
        const cacheKey = `extract:tavily:${failed.url}`;
        webCache.set(cacheKey, pageResult, 1 * 60 * 1000);
      });

      console.log(`[ExtractPage] Extracted ${results.filter(r => r.success).length}/${urls.length} pages (${cachedResults.length} from cache)`);
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

