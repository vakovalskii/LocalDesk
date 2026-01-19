/**
 * ZaiReaderTool - Read and parse web page content using Z.AI Reader API
 * Supports selectable return formats, cache control, image retention, and summary options.
 */

import type { ToolDefinition, ToolResult, ToolExecutionContext } from './base-tool.js';
import { webCache } from '../web-cache.js';

export interface ZaiReaderParams {
  url: string;
  explanation: string;
  timeout?: number;
  no_cache?: boolean;
  return_format?: 'markdown' | 'text';
  retain_images?: boolean;
  no_gfm?: boolean;
  keep_img_data_url?: boolean;
  with_images_summary?: boolean;
  with_links_summary?: boolean;
}

export interface ZaiReaderRequest {
  url: string;
  timeout?: number;
  no_cache?: boolean;
  return_format?: 'markdown' | 'text';
  retain_images?: boolean;
  no_gfm?: boolean;
  keep_img_data_url?: boolean;
  with_images_summary?: boolean;
  with_links_summary?: boolean;
}

export interface ZaiReaderResponse {
  id: string;
  created: number;
  request_id: string;
  model: string;
  reader_result: {
    content: string;
    description?: string;
    title: string;
    url: string;
    external?: {
      stylesheet?: Record<string, {
        type: string;
      }>;
    };
    metadata?: {
      keywords?: string;
      viewport?: string;
      description?: string;
      'format-detection'?: string;
    };
  };
}

export interface ZaiReaderError {
  code: number;
  message: string;
}

export const ZaiReaderToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "read_page",
    description: "Read and parse web page content using Z.AI Reader API. Supports markdown/text format, cache control, image retention, summary options. Available only when Z.AI Reader is enabled.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to retrieve and parse"
        },
        explanation: {
          type: "string",
          description: "Why you need to read this page and what you expect to find"
        },
        timeout: {
          type: "number",
          description: "Request timeout in seconds. Default is 20",
          minimum: 1,
          maximum: 120
        },
        no_cache: {
          type: "boolean",
          description: "Whether to disable caching (true/false). Default is false"
        },
        return_format: {
          type: "string",
          description: "Return format: 'markdown' or 'text'. Default is markdown",
          enum: ['markdown', 'text']
        },
        retain_images: {
          type: "boolean",
          description: "Whether to retain images (true/false). Default is true"
        },
        no_gfm: {
          type: "boolean",
          description: "Whether to disable GitHub Flavored Markdown (true/false). Default is false"
        },
        keep_img_data_url: {
          type: "boolean",
          description: "Whether to keep image data URLs (true/false). Default is false"
        },
        with_images_summary: {
          type: "boolean",
          description: "Whether to include image summary (true/false). Default is false"
        },
        with_links_summary: {
          type: "boolean",
          description: "Whether to include links summary (true/false). Default is false"
        }
      },
      required: ["url", "explanation"]
    }
  }
};

/**
 * Z.AI Reader tool implementation
 */
export class ZaiReaderTool {
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
    console.log(`[ZaiReader] Using API URL: ${this.baseUrl}`);
  }

  /**
   * Read and parse a web page
   */
  async read(params: ZaiReaderParams): Promise<ZaiReaderResponse> {
    const { url, timeout = 20 } = params;

    console.log(`[ZaiReader] Reading URL: "${url}"`);

    // Check cache first (unless no_cache is true)
    if (!params.no_cache) {
      const cacheKey = `reader:zai:${url}`;
      const cached = await webCache.get(cacheKey);
      if (cached) {
        console.log(`[ZaiReader] Cache hit for URL: ${url}`);
        return cached as ZaiReaderResponse;
      }
    }

    try {
      const request: ZaiReaderRequest = {
        url,
        timeout,
        no_cache: params.no_cache ?? false,
        return_format: params.return_format ?? 'markdown',
        retain_images: params.retain_images ?? true,
        no_gfm: params.no_gfm ?? false,
        keep_img_data_url: params.keep_img_data_url ?? false,
        with_images_summary: params.with_images_summary ?? false,
        with_links_summary: params.with_links_summary ?? false,
      };

      const response = await fetch(`${this.baseUrl}/paas/v4/reader`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept-Language': 'en-US,en'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as ZaiReaderError;
        throw new Error(`Z.AI Reader API error: ${response.status} ${errorData.message || 'Unknown error'}`);
      }

      const data = await response.json() as ZaiReaderResponse;

      console.log(`[ZaiReader] Successfully read page. Title: "${data.reader_result?.title || 'N/A'}"`);

      // Cache the result (TTL: 10 minutes)
      if (!params.no_cache) {
        const cacheKey = `reader:zai:${url}`;
        await webCache.set(cacheKey, data, 10 * 60 * 1000);
      }

      return data;

    } catch (error) {
      console.error('[ZaiReader] Error:', error);
      throw error;
    }
  }

  /**
   * Format the reader response for display to the user
   */
  formatResponse(response: ZaiReaderResponse, contentLimit: number = 10000): string {
    const result = response.reader_result;
    
    let formatted = '📖 **Web Page Content (Z.AI Reader)**\n\n';
    
    // Add page info
    formatted += `**Title:** ${result.title || 'N/A'}\n`;
    formatted += `**URL:** ${result.url}\n`;
    
    if (result.description) {
      formatted += `**Description:** ${result.description}\n`;
    }
    
    formatted += '\n---\n\n';
    
    // Add metadata if available
    if (result.metadata && Object.keys(result.metadata).length > 0) {
      formatted += '**Page Metadata:**\n';
      if (result.metadata.description) {
        formatted += `- Meta Description: ${result.metadata.description}\n`;
      }
      if (result.metadata.keywords) {
        formatted += `- Keywords: ${result.metadata.keywords}\n`;
      }
      formatted += '\n';
    }
    
    // Add main content
    formatted += '**Content:**\n\n';
    
    const content = result.content || '';
    const preview = content.substring(0, contentLimit);
    formatted += preview;
    
    if (content.length > contentLimit) {
      formatted += `\n\n...[Content truncated. Showing first ${contentLimit} of ${content.length} characters]...`;
    }
    
    formatted += '\n\n---\n';
    formatted += '\n**Note:** This content was fetched and parsed using Z.AI Reader API.';
    
    return formatted;
  }

  /**
   * Format as ToolResult for execution context
   */
  async execute(params: ZaiReaderParams, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const response = await this.read(params);
      const formatted = this.formatResponse(response);
      
      return {
        success: true,
        output: formatted
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
