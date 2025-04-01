import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initConsoleLogger } from './client';
import net from 'node:net';

interface LogMessage {
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

describe('mcps-logger e2e tests', () => {
  const TEST_PORT = 9876;
  let server: net.Server;
  let receivedMessages: LogMessage[] = [];
  let cleanup: (() => void) | null = null;

  // Create a mock TCP server that will receive log messages
  beforeEach(() => {
    return new Promise<void>((resolve, reject) => {
      receivedMessages = [];
      server = net.createServer((socket) => {
        let buffer = '';
        
        socket.on('data', (data) => {
          try {
            const chunk = data.toString();
            buffer += chunk;
            
            // Process complete messages (each message ends with newline)
            const messages = buffer.split('\n');
            buffer = messages.pop() || ''; // Keep the last incomplete chunk
            
            for (const msg of messages) {
              if (msg) {
                try {
                  receivedMessages.push(JSON.parse(msg));
                } catch (e) {
                  // Ignore invalid JSON
                }
              }
            }
          } catch (err) {
            console.error('Error processing data:', err);
          }
        });

        socket.on('error', (err) => {
          console.error('Socket error:', err);
        });
      });
      
      server.on('error', (err) => {
        console.error('Server error:', err);
        reject(err);
      });
      
      server.listen(TEST_PORT, () => {
        resolve();
      });
    });
  });

  afterEach(() => {
    return new Promise<void>((resolve) => {
      // First cleanup logger
      if (cleanup) {
        try {
          cleanup();
        } catch (err) {
          console.error('Error during cleanup:', err);
        }
        cleanup = null;
      }
      
      // Then close server
      if (server) {
        server.close(() => {
          server.unref();
          resolve();
        });
      } else {
        resolve();
      }
    });
  });

  // Helper to wait for connections and message processing
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  it('should intercept console logs and send them to the server', async () => {
    // Initialize the logger
    cleanup = initConsoleLogger({ port: TEST_PORT });
    
    // Give it time to connect
    await wait(1000);
    
    // Send some test logs
    console.log('Test info message');
    console.warn('Test warning message');
    console.error('Test error message');
    console.debug('Test debug message');
    
    // Wait for messages to be processed
    await wait(1000);
    
    // Verify logs were received
    expect(receivedMessages.length).toBeGreaterThanOrEqual(4);
    
    expect(receivedMessages.find(m => m.level === 'info' && m.message === 'Test info message')).toBeTruthy();
    expect(receivedMessages.find(m => m.level === 'warn' && m.message === 'Test warning message')).toBeTruthy();
    expect(receivedMessages.find(m => m.level === 'error' && m.message === 'Test error message')).toBeTruthy();
    expect(receivedMessages.find(m => m.level === 'debug' && m.message === 'Test debug message')).toBeTruthy();
  });

  it('should stringify objects in console logs', async () => {
    cleanup = initConsoleLogger({ port: TEST_PORT });
    await wait(1000);
    
    const testObject = { name: 'test', value: 123 };
    console.log('Object test:', testObject);
    
    await wait(1000);
    
    const objectLogMessage = receivedMessages.find(m => 
      m.level === 'info' && m.message.includes('Object test:') && m.message.includes('"name":"test"')
    );
    
    expect(objectLogMessage).toBeTruthy();
  });

  // Split the reconnection test into two separate tests to avoid timing issues
  it('should queue messages when server is not available', async () => {
    // Close the server first
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    
    // Initialize logger without a server running
    cleanup = initConsoleLogger({ port: TEST_PORT });
    
    // Log some messages - these should be queued
    console.log('Queued message 1');
    console.log('Queued message 2');
    
    // Wait a bit
    await wait(1000);
    
    // Start the server again 
    server = net.createServer((socket) => {
      let buffer = '';
      
      socket.on('data', (data) => {
        const chunk = data.toString();
        buffer += chunk;
        
        const messages = buffer.split('\n');
        buffer = messages.pop() || '';
        
        for (const msg of messages) {
          if (msg) {
            try {
              receivedMessages.push(JSON.parse(msg));
            } catch (e) {
              // Ignore invalid JSON
            }
          }
        }
      });
    });
    
    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, () => resolve());
    });
    
    // Wait for reconnection and message processing
    await wait(3000);
    
    // Verify our queued messages were sent
    expect(receivedMessages.some(m => m.message.includes('Queued message 1'))).toBeTruthy();
    expect(receivedMessages.some(m => m.message.includes('Queued message 2'))).toBeTruthy();
  });

  it('should cleanup correctly and restore original console methods', async () => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalDebug = console.debug;
    
    cleanup = initConsoleLogger({ port: TEST_PORT });
    expect(console.log).not.toBe(originalLog);
    
    if (cleanup) {
      cleanup();
    }
    
    expect(console.log).toBe(originalLog);
    expect(console.warn).toBe(originalWarn);
    expect(console.error).toBe(originalError);
    expect(console.debug).toBe(originalDebug);
  });

  it('should not reinitialize if already initialized', async () => {
    const firstCleanup = initConsoleLogger({ port: TEST_PORT });
    const secondCleanup = initConsoleLogger({ port: TEST_PORT });
    
    expect(firstCleanup).toBe(secondCleanup);
    
    if (firstCleanup) {
      cleanup = firstCleanup;
    }
  });
}); 