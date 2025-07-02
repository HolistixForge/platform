import * as http from 'http';
import * as https from 'https';
import * as url from 'url';

interface ProxyRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
}

interface ProxyResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: any;
    error?: {
        message: string;
        status: number;
        json?: any;
    };
}

const TRUNCATED_LINES = 150;

/**
 * Logger utility for proxy requests and responses
 */
class ProxyLogger {
    private static formatHeaders(headers: Record<string, string>): string {
        return Object.entries(headers)
            .map(([key, value]) => `  ${key}: ${value}`)
            .join('\n');
    }

    private static formatBody(body: any, contentType?: string): string {
        if (!body) return '  <no body>';

        if (contentType?.includes('application/json')) {
            const jsonString = JSON.stringify(body, null, 2);
            const lines = jsonString.split('\n');

            if (lines.length > TRUNCATED_LINES) {
                const truncatedLines = lines.slice(0, TRUNCATED_LINES);
                return `  ${truncatedLines.join('\n')}\n  ... (truncated at ${TRUNCATED_LINES} lines, total: ${lines.length} lines)`;
            }

            return `  ${jsonString}`;
        } else if (contentType?.includes('application/x-www-form-urlencoded')) {
            if (typeof body === 'object') {
                return `  ${new URLSearchParams(body).toString()}`;
            }
            return `  ${body}`;
        } else if (typeof body === 'string') {
            const lines = body.split('\n');

            if (lines.length > TRUNCATED_LINES) {
                const truncatedLines = lines.slice(0, TRUNCATED_LINES);
                return `  ${truncatedLines.join('\n')}\n  ... (truncated at ${TRUNCATED_LINES} lines, total: ${lines.length} lines)`;
            }

            return `  ${body}`;
        } else {
            const jsonString = JSON.stringify(body, null, 2);
            const lines = jsonString.split('\n');

            if (lines.length > TRUNCATED_LINES) {
                const truncatedLines = lines.slice(0, TRUNCATED_LINES);
                return `  ${truncatedLines.join('\n')}\n  ... (truncated at ${TRUNCATED_LINES} lines, total: ${lines.length} lines)`;
            }

            return `  ${jsonString}`;
        }
    }

    private static buildCurlCommand(
        method: string,
        url: string,
        headers: Record<string, string>,
        body?: any
    ): string {
        let curl = `curl -X ${method.toUpperCase()} '${url}'`;

        // Add headers
        Object.entries(headers).forEach(([key, value]) => {
            if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length') {
                // Escape single quotes in header values
                const escapedValue = value.replace(/'/g, "'\"'\"'");
                curl += ` \\\n  -H '${key}: ${escapedValue}'`;
            }
        });

        // Add body based on Content-Type header
        if (body) {
            const contentType = headers['content-type'] || headers['Content-Type'] || '';

            if (contentType.includes('application/json')) {
                // Escape single quotes in JSON
                const escapedJson = JSON.stringify(body).replace(/'/g, "'\"'\"'");
                curl += ` \\\n  -d '${escapedJson}'`;
            } else if (contentType.includes('application/x-www-form-urlencoded')) {
                // Handle form-encoded data
                if (typeof body === 'object') {
                    const formData = new URLSearchParams(body).toString();
                    const escapedFormData = formData.replace(/'/g, "'\"'\"'");
                    curl += ` \\\n  -d '${escapedFormData}'`;
                } else {
                    const escapedFormData = body.toString().replace(/'/g, "'\"'\"'");
                    curl += ` \\\n  -d '${escapedFormData}'`;
                }
            } else if (contentType.includes('multipart/form-data')) {
                // Handle multipart form data
                if (typeof body === 'object') {
                    Object.entries(body).forEach(([key, value]) => {
                        if (typeof value === 'string') {
                            const escapedValue = value.replace(/'/g, "'\"'\"'");
                            curl += ` \\\n  -F '${key}=${escapedValue}'`;
                        } else if (value instanceof File || (value && typeof value === 'object' && 'name' in value)) {
                            // Handle file uploads
                            const fileName = (value as any).name || 'file';
                            curl += ` \\\n  -F '${key}=@${fileName}'`;
                        } else {
                            const escapedValue = JSON.stringify(value).replace(/'/g, "'\"'\"'");
                            curl += ` \\\n  -F '${key}=${escapedValue}'`;
                        }
                    });
                } else {
                    const escapedValue = body.toString().replace(/'/g, "'\"'\"'");
                    curl += ` \\\n  -d '${escapedValue}'`;
                }
            } else {
                // Handle raw body
                const escapedBody = body.toString().replace(/'/g, "'\"'\"'");
                curl += ` \\\n  -d '${escapedBody}'`;
            }
        }

        return curl;
    }

    static logRequest(proxyRequest: ProxyRequest): void {
        const parsedUrl = url.parse(proxyRequest.url);
        const queryParams = parsedUrl.query ? `?${parsedUrl.query}` : '';

        console.log('\n' + '='.repeat(80));
        console.log(`📤 PROXY REQUEST: ${proxyRequest.method} ${proxyRequest.url}`);
        console.log('='.repeat(80));

        // Log basic info
        console.log(`Method: ${proxyRequest.method}`);
        console.log(`URL: ${proxyRequest.url}`);
        console.log(`Protocol: ${parsedUrl.protocol}`);
        console.log(`Host: ${parsedUrl.hostname}`);
        console.log(`Port: ${parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80')}`);
        console.log(`Path: ${parsedUrl.pathname}`);
        if (queryParams) {
            console.log(`Query Parameters: ${queryParams}`);
        }

        // Log headers
        console.log('\n📋 Headers:');
        console.log(this.formatHeaders(proxyRequest.headers));

        // Log body
        if (proxyRequest.body) {
            const contentType = proxyRequest.headers['content-type'] || proxyRequest.headers['Content-Type'] || 'unknown';
            console.log(`\n📦 Body (${contentType}):`);
            console.log(this.formatBody(proxyRequest.body, contentType));
        } else {
            console.log('\n📦 Body: <no body>');
        }

        // Log curl equivalent
        console.log('\n🔗 cURL Equivalent:');
        console.log(this.buildCurlCommand(
            proxyRequest.method,
            proxyRequest.url,
            proxyRequest.headers,
            proxyRequest.body
        ));

        console.log('='.repeat(80));
    }

    static logResponse(proxyResponse: ProxyResponse, originalUrl: string): void {
        console.log('\n' + '='.repeat(80));
        console.log(`📥 PROXY RESPONSE: ${originalUrl}`);
        console.log('='.repeat(80));

        // Log status
        console.log(`Status: ${proxyResponse.statusCode}`);

        // Log headers
        console.log('\n📋 Response Headers:');
        console.log(this.formatHeaders(proxyResponse.headers));

        // Log body
        const contentType = proxyResponse.headers['content-type'] || proxyResponse.headers['Content-Type'];
        console.log(`\n📦 Response Body (${contentType || 'unknown'}):`);
        console.log(this.formatBody(proxyResponse.body, contentType));

        // Log error if present
        if (proxyResponse.error) {
            console.log('\n❌ Error Details:');
            console.log(`  Message: ${proxyResponse.error.message}`);
            console.log(`  Status: ${proxyResponse.error.status}`);
            if (proxyResponse.error.json) {
                console.log(`  Error JSON: ${JSON.stringify(proxyResponse.error.json, null, 2)}`);
            }
        }

        console.log('='.repeat(80) + '\n');
    }

    static logError(error: any, context: string): void {
        console.log('\n' + '❌'.repeat(20));
        console.log(`❌ PROXY ERROR: ${context}`);
        console.log('❌'.repeat(20));
        console.log(`Error: ${error.message || error}`);
        if (error.stack) {
            console.log(`Stack: ${error.stack}`);
        }
        console.log('❌'.repeat(20) + '\n');
    }
}

/**
 * Universal HTTP proxy server that can forward any request to external APIs
 */
export class ProxyServer {
    private server: http.Server;
    private port: number;
    private logResponseMethods: string[];

    constructor(port = 3001, options: { logResponseMethods?: string[] } = {}) {
        this.port = port;
        this.logResponseMethods = options.logResponseMethods || ['POST', 'PUT', 'DELETE', 'PATCH'];
        this.server = http.createServer(this.handleRequest.bind(this));
    }

    /**
     * Start the proxy server
     */
    start(): Promise<void> {
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`🚀 Universal proxy server running on http://localhost:${this.port}`);
                console.log(`📡 Ready to proxy requests to any API`);
                console.log(`📝 Logging enabled for: ${this.logResponseMethods.join(', ')} requests and responses`);
                console.log(`📋 Other methods will be proxied silently`);
                resolve();
            });
        });
    }

    /**
     * Stop the proxy server
     */
    stop(): Promise<void> {
        return new Promise((resolve) => {
            this.server.close(() => {
                console.log('🛑 Proxy server stopped');
                resolve();
            });
        });
    }

    /**
     * Handle incoming proxy requests
     */
    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Only handle POST requests to /proxy
        if (req.method !== 'POST' || req.url !== '/proxy') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
        }

        try {
            // Parse the proxy request
            const body = await this.parseRequestBody(req);
            const proxyRequest: ProxyRequest = JSON.parse(body);

            // Check if we should log this request/response based on method
            const shouldLogByMethod = this.logResponseMethods.includes(proxyRequest.method.toUpperCase());

            // Log the incoming request only for specified methods
            if (shouldLogByMethod) {
                ProxyLogger.logRequest(proxyRequest);
            } else {
                console.log(`🔄 Proxying ${proxyRequest.method} ${proxyRequest.url} (silent mode)`);
            }

            // Forward the request
            const result = await this.forwardRequest(proxyRequest);

            // Log the response if method is in logResponseMethods OR if status code is not 200
            const shouldLogResponse = shouldLogByMethod || (result.statusCode !== 200);

            if (shouldLogResponse) {
                if (!shouldLogByMethod)
                    ProxyLogger.logRequest(proxyRequest);
                ProxyLogger.logResponse(result, proxyRequest.url);
            } else {
                console.log(`✅ ${proxyRequest.method} ${proxyRequest.url} completed (${result.statusCode})`);
            }

            // Send the response
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error: any) {
            ProxyLogger.logError(error, 'Request handling');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: error.message || 'Proxy error',
                    status: 500
                }
            }));
        }
    }

    /**
     * Parse the request body
     */
    private parseRequestBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', reject);
        });
    }

    /**
     * Forward the request to the target URL
     */
    private async forwardRequest(proxyRequest: ProxyRequest): Promise<ProxyResponse> {
        return new Promise((resolve, reject) => {
            const parsedUrl = url.parse(proxyRequest.url);
            const isHttps = parsedUrl.protocol === 'https:';
            const client = isHttps ? https : http;

            // Prepare headers
            const headers = { ...proxyRequest.headers };

            // Remove headers that shouldn't be forwarded
            delete headers.host;
            delete headers['content-length'];

            // Prepare body based on Content-Type header
            let body: string | undefined;
            if (proxyRequest.body) {
                const contentType = headers['content-type'] || headers['Content-Type'] || '';

                if (contentType.includes('application/json')) {
                    body = proxyRequest.body;

                } else if (contentType.includes('application/x-www-form-urlencoded')) {
                    if (typeof proxyRequest.body === 'object') {
                        console.error('not tested');
                        body = new URLSearchParams(proxyRequest.body).toString();
                    } else {
                        body = proxyRequest.body.toString();
                    }
                } else if (contentType.includes('multipart/form-data')) {
                    // For multipart form data, we'll need to handle this differently
                    console.error('not tested');
                    body = proxyRequest.body;
                } else {
                    // For other content types, convert to string
                    body = proxyRequest.body.toString();
                }
            }

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.path,
                method: proxyRequest.method,
                headers,
            };

            // Allow self-signed certificates in development
            if (isHttps) {
                /*
                development(() => {
                    (options as any).rejectUnauthorized = false;
                });
                */
            }

            const proxyReq = client.request(options, (proxyRes) => {
                let responseBody = '';

                proxyRes.on('data', (chunk) => {
                    responseBody += chunk;
                });

                proxyRes.on('end', () => {
                    let parsedBody: any;

                    try {
                        // Try to parse as JSON
                        parsedBody = JSON.parse(responseBody);
                    } catch {
                        // If not JSON, return as string
                        parsedBody = responseBody;
                    }

                    const result: ProxyResponse = {
                        statusCode: proxyRes.statusCode || 500,
                        headers: proxyRes.headers as Record<string, string>,
                        body: parsedBody,
                    };

                    // If the response indicates an error, add error info
                    if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
                        result.error = {
                            message: `HTTP ${proxyRes.statusCode}`,
                            status: proxyRes.statusCode,
                            json: parsedBody,
                        };
                    }

                    resolve(result);
                });
            });

            proxyReq.on('error', (error) => {
                ProxyLogger.logError(error, 'Forward request');
                reject(error);
            });

            if (body) {
                proxyReq.write(body);
            }

            proxyReq.end();
        });
    }
}

/**
 * Start the proxy server (for direct usage)
 */
export async function startProxyServer(port = 3001, options?: { logResponseMethods?: string[] }): Promise<ProxyServer> {
    const server = new ProxyServer(port, options);
    await server.start();
    return server;
}

// If this file is run directly, start the server
if (require.main === module) {
    startProxyServer(3001, { logResponseMethods: ['PUT', 'DELETE', 'PATCH'] }).catch(console.error);
} 