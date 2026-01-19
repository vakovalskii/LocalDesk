/**
 * WebSearchTool - Search the web using Tavily or Z.AI API
 */

import { tavily } from '@tavily/core';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from './base-tool.js';
import type { WebSearchProvider } from '../../types.js';
import { webCache } from '../web-cache.js';

export interface WebSearchParams {
  query: string;
  explanation: string;
  max_results?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

export const WebSearchToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "search_web",
    description: "Search the web for real-time information. USE AS LAST RESORT - try search_text, search_files, read_file FIRST. This searches the INTERNET, not local files. Use for external documentation, current events, news, public APIs.",
    parameters: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
          description: "Why this search is needed and what to expect"
        },
        query: {
          type: "string",
          description: "Search query in same language as user request. Use specific terms and context. For acronyms, add context. Use quotes for exact phrases."
        },
        max_results: {
          type: "number",
          description: "Maximum results (1-10, default: 5)",
          minimum: 1,
          maximum: 10
        }
      },
      required: ["explanation", "query"]
    }
  }
};

/**
 * Tavily-based web search
 */
class TavilyWebSearch {
  private tvly: any;

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'dummy-key') {
      throw new Error('Tavily API key not configured. Please set it in Settings.');
    }
    this.tvly = tavily({ apiKey });
  }

  async search(params: WebSearchParams): Promise<SearchResult[]> {
    const { query, max_results = 5 } = params;

    console.log(`[TavilyWebSearch] Query: "${query}", max_results: ${max_results}`);

    // Check cache first (for sharing between threads)
    const cacheKey = `search:tavily:${query}:${max_results}`;
    const cached = await webCache.get(cacheKey);
    if (cached) {
      console.log(`[TavilyWebSearch] Cache hit for query: "${query}"`);
      return cached as SearchResult[];
    }

    try {
      const response = await this.tvly.search(query, {
        maxResults: Math.min(max_results, 10),
        includeRawContent: false,
        includeAnswer: false,
      });

      const results: SearchResult[] = response.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''),
        score: result.score,
      }));

      console.log(`[TavilyWebSearch] Found ${results.length} results`);

      // Cache the results (TTL: 5 minutes)
      await webCache.set(cacheKey, results, 5 * 60 * 1000);

      return results;

    } catch (error) {
      console.error('[TavilyWebSearch] Error:', error);
      throw error;
    }
  }
}

/**
 * Z.AI-based web search
 */
class ZaiWebSearch {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, zaiApiUrl: 'default' | 'coding' = 'default') {
    if (!apiKey || apiKey === 'dummy-key') {
      throw new Error('Z.AI API key not configured. Please set it in Settings.');
    }
    this.apiKey = apiKey;
    // Set base URL based on zaiApiUrl variant
    if (zaiApiUrl === 'coding') {
      this.baseUrl = 'https://api.z.ai/api/coding';
    } else {
      this.baseUrl = 'https://api.z.ai/api';
    }
    console.log(`[ZaiWebSearch] Using API URL: ${this.baseUrl}`);
  }

  async search(params: WebSearchParams): Promise<SearchResult[]> {
    const { query, max_results = 5 } = params;

    console.log(`[ZaiWebSearch] Query: "${query}", max_results: ${max_results}`);

    // Check cache first (for sharing between threads)
    const cacheKey = `search:zai:${query}:${max_results}`;
    const cached = await webCache.get(cacheKey);
    if (cached) {
      console.log(`[ZaiWebSearch] Cache hit for query: "${query}"`);
      return cached as SearchResult[];
    }

    try {
      const response = await fetch(`${this.baseUrl}/paas/v4/web_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept-Language': 'en-US,en'
        },
        body: JSON.stringify({
          search_engine: 'search-prime',
          search_query: query,
          count: Math.min(max_results, 50)
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Z.AI API error: ${response.status} ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();

      const results: SearchResult[] = (data.search_result || []).map((result: any) => ({
        title: result.title || '',
        url: result.link || '',
        snippet: result.content || result.title || '',
      }));

      console.log(`[ZaiWebSearch] Found ${results.length} results`);

      // Cache the results (TTL: 5 minutes)
      await webCache.set(cacheKey, results, 5 * 60 * 1000);

      return results;

    } catch (error) {
      console.error('[ZaiWebSearch] Error:', error);
      throw error;
    }
  }
}

/**
 * Main WebSearchTool class that supports multiple providers
 */
export class WebSearchTool {
  private searchProvider: TavilyWebSearch | ZaiWebSearch | null = null;

  constructor(apiKey: string, provider: WebSearchProvider = 'tavily', zaiApiUrl: 'default' | 'coding' = 'default') {
    if (!apiKey || apiKey === 'dummy-key') {
      throw new Error('API key not configured. Please set it in Settings.');
    }

    if (provider === 'tavily') {
      this.searchProvider = new TavilyWebSearch(apiKey);
    } else if (provider === 'zai') {
      this.searchProvider = new ZaiWebSearch(apiKey, zaiApiUrl);
    } else {
      throw new Error(`Unknown web search provider: ${provider}`);
    }
  }

  async search(params: WebSearchParams): Promise<SearchResult[]> {
    if (!this.searchProvider) {
      throw new Error('Web search provider not initialized');
    }

    return this.searchProvider.search(params);
  }

  formatResults(results: SearchResult[]): string {
    let formatted = '🔍 **Web Search Results**\n\n';
    formatted += '**IMPORTANT**: When citing information from these sources, ALWAYS include the source number [1], [2], etc. and the URL in your response.\n\n';

    results.forEach((result, index) => {
      const sourceNum = index + 1;
      formatted += `**[${sourceNum}]** ${result.title}\n`;
      formatted += `🔗 URL: ${result.url}\n`;
      formatted += `📝 ${result.snippet}\n\n`;
    });

    formatted += '\n---\n';
    formatted += '**Instructions for citing sources:**\n';
    formatted += '- Use [1], [2], etc. to reference sources in your answer\n';
    formatted += '- Include clickable URLs when mentioning specific information\n';
    formatted += '- Example: "According to [1](url), the price is..."\n';

    return formatted;
  }
}

