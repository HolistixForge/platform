import * as http from 'http';
import * as https from 'https';
import * as url from 'url';

interface ProxyRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    bodyType: 'json' | 'form' | 'formData' | 'none';
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

/**
 * Universal HTTP proxy server that can forward any request to external APIs
 */
export class ProxyServer {
    private server: http.Server;
    private port: number;

    constructor(port: number = 3001) {
        this.port = port;
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

            console.log(`🔄 Proxying ${proxyRequest.method} ${proxyRequest.url}`);

            // Forward the request
            const result = await this.forwardRequest(proxyRequest);

            // Send the response
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error: any) {
            console.error('❌ Proxy error:', error);
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

            // Prepare body
            let body: string | undefined;
            if (proxyRequest.body) {
                if (proxyRequest.bodyType === 'json') {
                    body = JSON.stringify(proxyRequest.body);
                    headers['content-type'] = 'application/json';
                } else if (proxyRequest.bodyType === 'form') {
                    body = new URLSearchParams(proxyRequest.body).toString();
                    headers['content-type'] = 'application/x-www-form-urlencoded';
                } else if (proxyRequest.bodyType === 'formData') {
                    // For form data, we'll need to handle this differently
                    body = JSON.stringify(proxyRequest.body);
                    headers['content-type'] = 'application/json';
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
                    //console.log('🔄     Proxy response data:', chunk);
                    responseBody += chunk;
                });

                proxyRes.on('end', () => {
                    //console.log('🔄     Proxy response end');
                    let parsedBody: any;

                    try {
                        // Try to parse as JSON
                        parsedBody = JSON.parse(responseBody);
                    } catch {
                        // If not JSON, return as string
                        parsedBody = responseBody;
                    }

                    //console.log('🔄     Proxy response parsed body:', parsedBody);

                    const result: ProxyResponse = {
                        statusCode: proxyRes.statusCode || 500,
                        headers: proxyRes.headers as Record<string, string>,
                        body: parsedBody,
                    };

                    //console.log('🔄     Proxy response result:', result);

                    // If the response indicates an error, add error info
                    if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
                        result.error = {
                            message: `HTTP ${proxyRes.statusCode}`,
                            status: proxyRes.statusCode,
                            json: parsedBody,
                        };
                    }

                    //console.log('🔄     Proxy response resolve:', result);

                    resolve(result);
                });
            });

            proxyReq.on('error', (error) => {
                console.error('❌ Forward request error:', error);
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
export async function startProxyServer(port: number = 3001): Promise<ProxyServer> {
    const server = new ProxyServer(port);
    await server.start();
    return server;
}

// If this file is run directly, start the server
if (require.main === module) {
    startProxyServer().catch(console.error);
} 