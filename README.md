# MCP Server Logger

console.log for your stdio MCP server

[![npm version](https://img.shields.io/npm/v/mcps-logger.svg)](https://www.npmjs.com/package/mcps-logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

When developing an MCP (Model Context Protocol) server that uses stdio transport, console.log statements interfere with the protocol communication. This package redirects logs to a separate terminal window through a TCP connection. It patches the console methods (log, warn, error, debug), allowing you to maintain your existing logging code while keeping the stdio channel clean for MCP communication.

## Usage

### 1. Install the logger in your MCP server
```shell
npm install mcps-logger
```

```typescript
// in your MCP server entry file
import { initConsoleLogger } from "mcps-logger";

initConsoleLogger();
```

Or if you want to use in development mode only:

```typescript
if (process.env.NODE_ENV !== "production") {
    import("mcps-logger").then(({ initConsoleLogger }) => {
        initConsoleLogger();
    });
}
```

### 2. Start the logger to receive logs from MCP server
```shell
npx mcps-logger
```