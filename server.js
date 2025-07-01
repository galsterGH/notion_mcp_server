#!/usr/bin/env node

/**
 * Notion MCP Server
 * 
 * This is a Model Context Protocol (MCP) server that provides integration with Notion.
 * It exposes two main tools:
 * 
 * 1. search_notion - Search for pages across your Notion workspace
 * 2. get_notion_page - Retrieve complete content and properties of a specific page
 * 
 * The server connects to Notion using the official Notion API client and transforms
 * Notion's complex data structures into simplified, readable formats. It handles
 * various Notion property types (text, numbers, dates, etc.) and block types
 * (paragraphs, headings, lists, code blocks, etc.).
 * 
 * Setup Requirements:
 * - NOTION_API_KEY environment variable must be set with your Notion integration token
 * - The integration must have appropriate permissions to read the pages you want to access
 * 
 * Communication Protocol:
 * - Uses stdio transport for communication with MCP clients
 * - Returns JSON-formatted responses with page metadata, properties, and content
 * - Supports pagination for pages with many blocks
 * 
 * Compatibility:
 * - Currently tested and working with Claude Desktop
 * - Should work with other MCP-compatible clients but not yet verified
 * 
 * @author Guy Alster
 * @version 1.0.0
 */

// Import required dependencies
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

// String constants for Notion property and block types
const PROPERTY_TYPES = {
  TITLE: 'title',
  RICH_TEXT: 'rich_text',
  NUMBER: 'number',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  DATE: 'date',
  CHECKBOX: 'checkbox',
  URL: 'url',
  EMAIL: 'email',
  PHONE_NUMBER: 'phone_number',
  PEOPLE: 'people',
  RELATION: 'relation'
};

const BLOCK_TYPES = {
  PARAGRAPH: 'paragraph',
  HEADING_1: 'heading_1',
  HEADING_2: 'heading_2',
  HEADING_3: 'heading_3',
  BULLETED_LIST_ITEM: 'bulleted_list_item',
  NUMBERED_LIST_ITEM: 'numbered_list_item',
  TO_DO: 'to_do',
  TOGGLE: 'toggle',
  CODE: 'code',
  QUOTE: 'quote',
  DIVIDER: 'divider'
};

const FIELD_NAMES = {
  PLAIN_TEXT: 'plain_text',
  NAME: 'name',
  START: 'start',
  CHECKED: 'checked',
  LANGUAGE: 'language',
  ID: 'id',
  URL: 'url',
  CREATED_TIME: 'created_time',
  LAST_EDITED_TIME: 'last_edited_time',
  PAGE_ID: 'page_id',
  BLOCK_ID: 'block_id',
  START_CURSOR: 'start_cursor',
  NEXT_CURSOR: 'next_cursor',
  RESULTS: 'results',
  PROPERTIES: 'properties',
  TYPE: 'type',
  OBJECT: 'object',
  PAGE: 'page'
};

const TOOL_NAMES = {
  SEARCH_NOTION: 'search_notion',
  GET_NOTION_PAGE: 'get_notion_page'
};

const SERVER_CONFIG = {
  NAME: 'notion-mcp-server',
  VERSION: '1.0.0'
};

const MARKDOWN_SYMBOLS = {
  H1: '# ',
  H2: '## ',
  H3: '### ',
  BULLET: '• ',
  NUMBER: '1. ',
  CHECKED: '✓',
  UNCHECKED: '○',
  TOGGLE: '▸ ',
  QUOTE: '> ',
  DIVIDER: '---',
  CODE_BLOCK_START: '```',
  CODE_BLOCK_END: '\n```',
  NEWLINE: '\n',
  DOUBLE_NEWLINE: '\n\n'
};

// Initialize Notion client with API key from environment variables
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

/**
 * Helper function to extract all properties from a Notion page
 * Converts various Notion property types into simplified JavaScript values
 * @param {Object} page - The Notion page object
 * @returns {Object} - Simplified properties object
 */
function extractAllProperties(page) {
  const properties = {};
  
  // Iterate through all properties in the page
  for (const [key, value] of Object.entries(page[FIELD_NAMES.PROPERTIES] || {})) {
    // Handle text-based properties (title and rich text)
    if (value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.TITLE || value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.RICH_TEXT) {
      properties[key] = value[value[FIELD_NAMES.TYPE]]?.map(t => t[FIELD_NAMES.PLAIN_TEXT]).join('') || '';
    } 
    // Handle numeric properties
    else if (value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.NUMBER) {
      properties[key] = value[PROPERTY_TYPES.NUMBER];
    } 
    // Handle single select dropdowns
    else if (value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.SELECT) {
      properties[key] = value[PROPERTY_TYPES.SELECT]?.[FIELD_NAMES.NAME] || null;
    } 
    // Handle multi-select dropdowns
    else if (value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.MULTI_SELECT) {
      properties[key] = value[PROPERTY_TYPES.MULTI_SELECT]?.map(s => s[FIELD_NAMES.NAME]) || [];
    } 
    // Handle date properties
    else if (value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.DATE) {
      properties[key] = value[PROPERTY_TYPES.DATE]?.[FIELD_NAMES.START] || null;
    } 
    // Handle checkbox properties
    else if (value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.CHECKBOX) {
      properties[key] = value[PROPERTY_TYPES.CHECKBOX];
    } 
    // Handle URL properties
    else if (value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.URL) {
      properties[key] = value[PROPERTY_TYPES.URL];
    } 
    // Handle email properties
    else if (value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.EMAIL) {
      properties[key] = value[PROPERTY_TYPES.EMAIL];
    } 
    // Handle phone number properties
    else if (value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.PHONE_NUMBER) {
      properties[key] = value[PROPERTY_TYPES.PHONE_NUMBER];
    } 
    // Handle people/user properties
    else if (value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.PEOPLE) {
      properties[key] = value[PROPERTY_TYPES.PEOPLE]?.map(p => p[FIELD_NAMES.NAME] || p[FIELD_NAMES.ID]) || [];
    } 
    // Handle relation properties (links to other pages)
    else if (value[FIELD_NAMES.TYPE] === PROPERTY_TYPES.RELATION) {
      properties[key] = value[PROPERTY_TYPES.RELATION]?.map(r => r[FIELD_NAMES.ID]) || [];
    } 
    // Handle any other property types by returning the raw value
    else {
      properties[key] = value;
    }
  }
  
  return properties;
}

/**
 * Helper function to get complete content from a Notion page
 * Retrieves page metadata, properties, and all block content
 * @param {string} pageId - The ID of the Notion page to retrieve
 * @returns {Object} - Object containing page data, properties, formatted content, and raw blocks
 */
async function getPageContent(pageId) {
  try {
    // Retrieve the page metadata and properties
    const page = await notion.pages.retrieve({ [FIELD_NAMES.PAGE_ID]: pageId });
    
    // Initialize array to store all blocks and pagination cursor
    const blocks = [];
    let cursor = undefined;
    
    // Paginate through all blocks in the page (Notion API returns max 100 blocks per request)
    do {
      const response = await notion.blocks.children.list({
        [FIELD_NAMES.BLOCK_ID]: pageId,
        [FIELD_NAMES.START_CURSOR]: cursor,
      });
      
      // Add blocks to our collection
      blocks.push(...response[FIELD_NAMES.RESULTS]);
      cursor = response[FIELD_NAMES.NEXT_CURSOR];
    } while (cursor); // Continue until no more pages
    
    // Convert blocks to formatted text content
    const content = blocks.map(block => {
      // Handle paragraph blocks
      if (block[FIELD_NAMES.TYPE] === BLOCK_TYPES.PARAGRAPH) {
        return block[BLOCK_TYPES.PARAGRAPH][PROPERTY_TYPES.RICH_TEXT].map(t => t[FIELD_NAMES.PLAIN_TEXT]).join('');
      } 
      // Handle heading blocks with markdown formatting
      else if (block[FIELD_NAMES.TYPE] === BLOCK_TYPES.HEADING_1) {
        return `${MARKDOWN_SYMBOLS.H1}${block[BLOCK_TYPES.HEADING_1][PROPERTY_TYPES.RICH_TEXT].map(t => t[FIELD_NAMES.PLAIN_TEXT]).join('')}`;
      } else if (block[FIELD_NAMES.TYPE] === BLOCK_TYPES.HEADING_2) {
        return `${MARKDOWN_SYMBOLS.H2}${block[BLOCK_TYPES.HEADING_2][PROPERTY_TYPES.RICH_TEXT].map(t => t[FIELD_NAMES.PLAIN_TEXT]).join('')}`;
      } else if (block[FIELD_NAMES.TYPE] === BLOCK_TYPES.HEADING_3) {
        return `${MARKDOWN_SYMBOLS.H3}${block[BLOCK_TYPES.HEADING_3][PROPERTY_TYPES.RICH_TEXT].map(t => t[FIELD_NAMES.PLAIN_TEXT]).join('')}`;
      } 
      // Handle list items
      else if (block[FIELD_NAMES.TYPE] === BLOCK_TYPES.BULLETED_LIST_ITEM) {
        return `${MARKDOWN_SYMBOLS.BULLET}${block[BLOCK_TYPES.BULLETED_LIST_ITEM][PROPERTY_TYPES.RICH_TEXT].map(t => t[FIELD_NAMES.PLAIN_TEXT]).join('')}`;
      } else if (block[FIELD_NAMES.TYPE] === BLOCK_TYPES.NUMBERED_LIST_ITEM) {
        return `${MARKDOWN_SYMBOLS.NUMBER}${block[BLOCK_TYPES.NUMBERED_LIST_ITEM][PROPERTY_TYPES.RICH_TEXT].map(t => t[FIELD_NAMES.PLAIN_TEXT]).join('')}`;
      } 
      // Handle to-do items with checkbox indicators
      else if (block[FIELD_NAMES.TYPE] === BLOCK_TYPES.TO_DO) {
        const checked = block[BLOCK_TYPES.TO_DO][FIELD_NAMES.CHECKED] ? MARKDOWN_SYMBOLS.CHECKED : MARKDOWN_SYMBOLS.UNCHECKED;
        return `${checked} ${block[BLOCK_TYPES.TO_DO][PROPERTY_TYPES.RICH_TEXT].map(t => t[FIELD_NAMES.PLAIN_TEXT]).join('')}`;
      } 
      // Handle toggle blocks (collapsible sections)
      else if (block[FIELD_NAMES.TYPE] === BLOCK_TYPES.TOGGLE) {
        return `${MARKDOWN_SYMBOLS.TOGGLE}${block[BLOCK_TYPES.TOGGLE][PROPERTY_TYPES.RICH_TEXT].map(t => t[FIELD_NAMES.PLAIN_TEXT]).join('')}`;
      } 
      // Handle code blocks with language syntax highlighting
      else if (block[FIELD_NAMES.TYPE] === BLOCK_TYPES.CODE) {
        return `${MARKDOWN_SYMBOLS.CODE_BLOCK_START}${block[BLOCK_TYPES.CODE][FIELD_NAMES.LANGUAGE]}${MARKDOWN_SYMBOLS.NEWLINE}${block[BLOCK_TYPES.CODE][PROPERTY_TYPES.RICH_TEXT].map(t => t[FIELD_NAMES.PLAIN_TEXT]).join('')}${MARKDOWN_SYMBOLS.CODE_BLOCK_END}`;
      } 
      // Handle quote blocks
      else if (block[FIELD_NAMES.TYPE] === BLOCK_TYPES.QUOTE) {
        return `${MARKDOWN_SYMBOLS.QUOTE}${block[BLOCK_TYPES.QUOTE][PROPERTY_TYPES.RICH_TEXT].map(t => t[FIELD_NAMES.PLAIN_TEXT]).join('')}`;
      } 
      // Handle divider blocks
      else if (block[FIELD_NAMES.TYPE] === BLOCK_TYPES.DIVIDER) {
        return MARKDOWN_SYMBOLS.DIVIDER;
      } 
      // Handle unsupported block types by showing their type
      else {
        return `[${block[FIELD_NAMES.TYPE]}]`;
      }
    }).filter(text => text.length > 0); // Remove empty content
    
    // Return comprehensive page data
    return {
      [FIELD_NAMES.PAGE]: page,
      [FIELD_NAMES.PROPERTIES]: extractAllProperties(page),
      content: content.join(MARKDOWN_SYMBOLS.DOUBLE_NEWLINE), // Join all content with double line breaks
      blocks: blocks
    };
  } catch (error) {
    throw new Error(`Failed to get page content: ${error.message}`);
  }
}

// Create MCP (Model Context Protocol) server instance
const server = new McpServer({
  name: SERVER_CONFIG.NAME,
  version: SERVER_CONFIG.VERSION,
});

/**
 * Register the search tool for finding pages in Notion
 * This tool allows searching across all accessible Notion pages
 */
server.registerTool(TOOL_NAMES.SEARCH_NOTION, {
  description: 'Search for pages in Notion',
  inputSchema: {
    query: z.string().describe('Search query for Notion pages')
  }
}, async ({ query }) => {
  try {
    // Log search query for debugging
    console.error(`Searching Notion for: ${query}`);
    
    // Perform search using Notion API with page filter
    const response = await notion.search({
      query: query,
      filter: {
        property: FIELD_NAMES.OBJECT,
        value: FIELD_NAMES.PAGE, // Only search for pages, not databases
      },
    });
    
    // Transform search results into simplified format
    const results = response[FIELD_NAMES.RESULTS].map(page => ({
      [FIELD_NAMES.ID]: page[FIELD_NAMES.ID],
      [FIELD_NAMES.URL]: page[FIELD_NAMES.URL],
      [FIELD_NAMES.CREATED_TIME]: page[FIELD_NAMES.CREATED_TIME],
      [FIELD_NAMES.LAST_EDITED_TIME]: page[FIELD_NAMES.LAST_EDITED_TIME],
      [FIELD_NAMES.PROPERTIES]: extractAllProperties(page), // Use our helper function to extract properties
    }));
    
    // Return formatted response for MCP client
    return {
      content: [{
        [FIELD_NAMES.TYPE]: 'text',
        text: JSON.stringify({
          query: query,
          total_results: results.length,
          results: results
        }, null, 2)
      }]
    };
  } catch (error) {
    console.error('Search error:', error);
    throw new Error(`Failed to search Notion: ${error.message}`);
  }
});

/**
 * Register the get page tool for retrieving complete page content
 * This tool fetches a specific page with all its content and properties
 */
server.registerTool(TOOL_NAMES.GET_NOTION_PAGE, {
  description: 'Get complete content and properties of a specific Notion page',
  inputSchema: {
    [FIELD_NAMES.PAGE_ID]: z.string().describe('The ID of the Notion page to retrieve')
  }
}, async ({ [FIELD_NAMES.PAGE_ID]: page_id }) => {
  try {
    // Log page retrieval for debugging
    console.error(`Getting page content for: ${page_id}`);
    
    // Get comprehensive page data using our helper function
    const pageData = await getPageContent(page_id);
    
    // Return formatted response with page content and metadata
    return {
      content: [{
        [FIELD_NAMES.TYPE]: 'text',
        text: JSON.stringify({
          [FIELD_NAMES.PAGE_ID]: page_id,
          [FIELD_NAMES.URL]: pageData[FIELD_NAMES.PAGE][FIELD_NAMES.URL],
          [FIELD_NAMES.PROPERTIES]: pageData[FIELD_NAMES.PROPERTIES],
          content: pageData.content, // Formatted markdown-like content
          total_blocks: pageData.blocks.length
        }, null, 2)
      }]
    };
  } catch (error) {
    console.error('Get page error:', error);
    throw new Error(`Failed to get page: ${error.message}`);
  }
});

/**
 * Main function to start the MCP server
 * Sets up stdio transport and connects the server
 */
async function main() {
  // Create stdio transport for communication with MCP client
  const transport = new StdioServerTransport();
  
  // Connect server to transport
  await server.connect(transport);
  
  // Log successful startup
  console.error('Notion MCP server running!');
}

// Start the server and handle any startup errors
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1); // Exit with error code if startup fails
});