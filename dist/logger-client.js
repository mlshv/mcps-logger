"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initConsoleLogger = initConsoleLogger;
const node_net_1 = __importDefault(require("node:net"));
const port = Number(process.env.MCPS_LOGGER_PORT) || 8099;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 2000;
let isLoggerInitialized = false;
let cleanupFunction = null;
function initConsoleLogger() {
    if (isLoggerInitialized && cleanupFunction) {
        return cleanupFunction;
    }
    isLoggerInitialized = true;
    let socket = null;
    let reconnectAttempts = 0;
    const messageQueue = [];
    let connected = false;
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        debug: console.debug || console.log,
    };
    function connectToServer() {
        socket = new node_net_1.default.Socket();
        socket.connect(port, "localhost", () => {
            connected = true;
            reconnectAttempts = 0;
            while (messageQueue.length > 0) {
                const msg = messageQueue.shift();
                if (msg)
                    sendToServer(msg);
            }
        });
        socket.on("error", (err) => {
            connected = false;
            socket = null;
            if (err.message.includes("ECONNREFUSED") &&
                reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(connectToServer, RECONNECT_INTERVAL);
            }
            else {
                originalConsole.error("\x1b[31m%s\x1b[0m", "Failed to connect to debug server:", err.message);
            }
        });
        socket.on("close", () => {
            connected = false;
            socket = null;
        });
    }
    function sendToServer(entry) {
        if (connected && socket) {
            socket.write(`${JSON.stringify(entry)}\n`);
        }
        else {
            messageQueue.push(entry);
        }
    }
    console.log = (...args) => {
        sendToServer({
            level: "info",
            message: args
                .map((arg) => typeof arg === "object" ? JSON.stringify(arg) : String(arg))
                .join(" "),
        });
    };
    console.warn = (...args) => {
        sendToServer({
            level: "warn",
            message: args
                .map((arg) => typeof arg === "object" ? JSON.stringify(arg) : String(arg))
                .join(" "),
        });
    };
    console.error = (...args) => {
        sendToServer({
            level: "error",
            message: args
                .map((arg) => typeof arg === "object" ? JSON.stringify(arg) : String(arg))
                .join(" "),
        });
    };
    console.debug = (...args) => {
        sendToServer({
            level: "debug",
            message: args
                .map((arg) => typeof arg === "object" ? JSON.stringify(arg) : String(arg))
                .join(" "),
        });
    };
    connectToServer();
    cleanupFunction = () => {
        if (socket)
            socket.end();
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        console.debug = originalConsole.debug;
        isLoggerInitialized = false;
        cleanupFunction = null;
    };
    return cleanupFunction;
}
