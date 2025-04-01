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
  let reconnectTimeout: NodeJS.Timeout | null = null;

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug || console.log,
  };

  function connectToServer() {
    // Clear any existing socket
    if (socket) {
      socket.removeAllListeners();
      socket.destroy();
    }

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
      
      if (err.message.includes("ECONNREFUSED")) {
        scheduleReconnect();
      } else {
        originalConsole.error(
          "\x1b[31m%s\x1b[0m",
          "Failed to connect to debug server:",
          err.message
        );
        scheduleReconnect();
      }
    });

    socket.on("close", () => {
      connected = false;
      scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    // Clear any existing reconnect timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    // Only schedule a reconnect if we're still initialized
    if (isLoggerInitialized) {
      reconnectTimeout = setTimeout(connectToServer, RECONNECT_INTERVAL);
    }
  }

  function sendToServer(entry: LogEntry) {
    if (connected && socket) {
      socket.write(`${JSON.stringify(entry)}\n`);
    } else {
      // Cap the queue size to prevent memory issues
      if (messageQueue.length < 1000) {
        messageQueue.push(entry);
      }
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
    isLoggerInitialized = false;
    
    // Clear reconnect timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    // Clean up socket
    if (socket) {
      socket.removeAllListeners();
      socket.destroy();
      socket = null;
    }
    
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    
    cleanupFunction = null;
  };

  return cleanupFunction;
}
