# MCP Server Logger

console.log for your stdio MCP server

[![npm version](https://img.shields.io/npm/v/mcps-logger.svg)](https://www.npmjs.com/package/mcps-logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Why?

When developing an MCP (Model Context Protocol) server with stdio transport, console.log interferes with the protocol communication.

This package patches the console methods (log, warn, error, debug) and redirects logs to a separate terminal.

https://github.com/user-attachments/assets/33ff367e-74b4-48e8-9f04-0bcafbad5e00

## Usage

Start the logger in a terminal where you want to see the logs:
```shell
npx mcps-logger
```

Install the logger in your MCP server:
```shell
npm install mcps-logger
```

Add it to your MCP server entry file:
```typescript
import "mcps-logger/console";
```

Or if you want to use in development mode only:

```typescript
if (process.env.NODE_ENV !== "production") {
    import("mcps-logger/console");
}
```

