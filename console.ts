import net from "node:net";

const RECONNECT_INTERVAL = 2000;

interface LogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

let isLoggerInitialized = false;
let cleanupFunction: (() => void) | null = null;

export function initConsoleLogger({
  port = 8099,
}: {
  port?: number;
} = {}) {
  if (isLoggerInitialized && cleanupFunction) {
    return cleanupFunction;
  }

  isLoggerInitialized = true;
  let socket: net.Socket | null = null;
  const messageQueue: LogEntry[] = [];
  let connected = false;

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug || console.log,
  };

  function connectToServer() {
    socket = new net.Socket();

    socket.connect(port, "localhost", () => {
      connected = true;

      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        if (msg) sendToServer(msg);
      }
    });

    socket.on("error", (err) => {
      connected = false;
      socket = null;

      if (err.message.includes("ECONNREFUSED")) {
        setTimeout(connectToServer, RECONNECT_INTERVAL);
      } else {
        originalConsole.error(
          "\x1b[31m%s\x1b[0m",
          "Failed to connect to debug server:",
          err.message
        );
        setTimeout(connectToServer, RECONNECT_INTERVAL);
      }
    });

    socket.on("close", () => {
      connected = false;
      socket = null;
      setTimeout(connectToServer, RECONNECT_INTERVAL);
    });
  }

  function sendToServer(entry: LogEntry) {
    if (connected && socket) {
      socket.write(`${JSON.stringify(entry)}\n`);
    } else {
      messageQueue.push(entry);
    }
  }

  console.log = (...args: Parameters<typeof console.log>) => {
    sendToServer({
      level: "info",
      message: args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" "),
    });
  };

  console.warn = (...args: Parameters<typeof console.warn>) => {
    sendToServer({
      level: "warn",
      message: args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" "),
    });
  };

  console.error = (...args: Parameters<typeof console.error>) => {
    sendToServer({
      level: "error",
      message: args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" "),
    });
  };

  console.debug = (...args: Parameters<typeof console.debug>) => {
    sendToServer({
      level: "debug",
      message: args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" "),
    });
  };

  connectToServer();

  cleanupFunction = () => {
    if (socket) socket.end();
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    isLoggerInitialized = false;
    cleanupFunction = null;
  };

  return cleanupFunction;
}

// Check if file is being executed directly
const isDirectExecution = process.argv[1] === __filename;

if (isDirectExecution) {
  initConsoleLogger();
}
