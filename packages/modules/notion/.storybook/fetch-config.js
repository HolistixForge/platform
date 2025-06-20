// fetch-config.js - Configuration for fetch tracer
window.FETCH_TRACER_CONFIG = {
  // Proxy configuration
  proxyUrl: 'http://localhost:3001', // Your proxy server URL

  // Localhost patterns that should NOT be proxied
  localhostPatterns: [
    /^https?:\/\/localhost/,
    /^https?:\/\/127\.0\.0\.1/,
    /^https?:\/\/0\.0\.0\.0/,
    /^https?:\/\/\[::1\]/,
    /^file:\/\//,
    /^data:/,
    /^blob:/,
  ],

  // Additional patterns to exclude from proxying (optional)
  excludePatterns: [
    // Add any additional patterns here
    // /^https?:\/\/your-internal-api\.com/
  ],

  // Logging configuration
  logging: {
    enabled: true,
    level: 'info', // 'debug', 'info', 'warn', 'error'
    includeStack: true,
    includeHeaders: false,
    includeBody: false,
  },

  // Proxy request configuration
  proxy: {
    timeout: 30000, // 30 seconds
    retries: 3,
    retryDelay: 1000, // 1 second
  },
};
