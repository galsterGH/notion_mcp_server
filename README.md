# Notion MCP Server

This project exposes a small server that implements the Model Context Protocol (MCP) for Notion. It allows MCP compatible clients to search Notion pages and retrieve full page content via the command line.

## Prerequisites

- Node.js 18 or later
- A Notion integration token with access to the pages you want to query (set as `NOTION_API_KEY` in your environment)

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```
2. Ensure the `NOTION_API_KEY` environment variable is available. You can create a `.env` file and add:
   ```
   NOTION_API_KEY=your_notion_token
   ```

## Usage

Start the server with:

```bash
node server.js
```

The server communicates using standard input and output. It registers two tools:

- **search_notion** – search for pages in your workspace
- **get_notion_page** – fetch a page and return its properties and formatted content

Refer to `server.js` for full details on the protocol and available fields.

## Development

The project is written in modern JavaScript and uses ES modules. Feel free to modify `server.js` and run the server again to test your changes.

## License

This project is released under the ISC license.
