#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_net_1 = __importDefault(require("node:net"));
const defaultPort = 8099;
const envPort = process.env.MCPS_LOGGER_PORT;
const port = envPort ? Number(envPort) : defaultPort;
const server = node_net_1.default.createServer((socket) => {
    socket.on("data", (data) => {
        const messages = data.toString().split("\n").filter(Boolean);
        for (const msgStr of messages) {
            try {
                const { level, message } = JSON.parse(msgStr);
                switch (level) {
                    case "error":
                        console.error(message);
                        break;
                    case "warn":
                        console.warn(message);
                        break;
                    case "debug":
                        console.log(message);
                        break;
                    default:
                        console.log(message);
                }
            }
            catch (error) {
                const err = error instanceof Error ? error : new Error("Unknown error");
                console.error("Error parsing message:", err.message);
            }
        }
    });
    socket.on("error", (err) => {
        console.error("\x1b[31m%s\x1b[0m", "Debug socket error:", err.message);
    });
});
server.listen(port, () => {
    console.log("\x1b[36m%s\x1b[0m", `Receiving logs${port !== defaultPort ? ` on port ${port}` : ""}`);
});
server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error("\x1b[31m%s\x1b[0m", `Port ${port} is already in use`);
    }
    else {
        console.error("\x1b[31m%s\x1b[0m", "Debug server error:", err.message);
    }
});
process.on("SIGINT", () => {
    server.close();
    process.exit(0);
});
process.on("SIGTERM", () => {
    server.close();
    process.exit(0);
});
