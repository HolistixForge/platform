import { TMyfetchRequest, TJson } from '@monorepo/simple-types';

/**
 * A universal fetch polyfill that routes requests through a local proxy server
 * to avoid CORS issues when running backend code in browser environments.
 */
export class BrowserProxyFetch {
    private proxyUrl: string;
    private isEnabled: boolean;

    constructor(proxyUrl: string = 'http://localhost:3001', enabled: boolean = true) {
        this.proxyUrl = proxyUrl;
        this.isEnabled = enabled;
    }

    /**
     * Check if we're running in a browser environment
     */
    private isBrowser(): boolean {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }

    /**
     * Check if the request should be proxied
     */
    private shouldProxy(url: string): boolean {
        if (!this.isEnabled || !this.isBrowser()) {
            return false;
        }

        // Don't proxy requests to the proxy itself
        if (url.startsWith(this.proxyUrl)) {
            return false;
        }

        // Don't proxy relative URLs
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
            return false;
        }

        // Don't proxy localhost requests (except to our proxy)
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
            return false;
        }

        return true;
    }

    /**
     * Convert a fetch request to our proxy format
     */
    private async proxyRequest(request: TMyfetchRequest): Promise<TJson> {
        const proxyRequest = {
            method: request.method,
            url: request.url,
            headers: request.headers || {},
            body: request.jsonBody || request.formUrlencoded || request.formData,
            bodyType: request.jsonBody ? 'json' : request.formUrlencoded ? 'form' : request.formData ? 'formData' : 'none',
        };

        const response = await fetch(`${this.proxyUrl}/proxy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(proxyRequest),
        });

        if (!response.ok) {
            throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        // If the proxy returned an error, throw it
        if (result.error) {
            const error = new Error(result.error.message || 'Proxy request failed');
            (error as any).status = result.error.status;
            (error as any).json = result.error.json;
            throw error;
        }

        return result;
    }

    /**
     * Main fetch method that either proxies or uses native fetch
     */
    async fetch(request: TMyfetchRequest): Promise<TJson> {
        if (this.shouldProxy(request.url)) {
            return this.proxyRequest(request);
        }

        // Use native fetch for non-proxied requests
        const response = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.jsonBody ? JSON.stringify(request.jsonBody) :
                request.formUrlencoded ? new URLSearchParams(request.formUrlencoded as Record<string, string>) :
                    request.formData ? this.createFormData(request.formData) : undefined,
        });

        const responseText = await response.text();
        let json: TJson;

        try {
            json = JSON.parse(responseText);
        } catch {
            json = { response: responseText };
        }

        if (!response.ok) {
            const error = new Error('Request failed');
            (error as any).status = response.status;
            (error as any).json = json;
            throw error;
        }

        return json;
    }

    /**
     * Create FormData from the request
     */
    private createFormData(formData: Record<string, any>): FormData {
        const fd = new FormData();
        for (const [key, value] of Object.entries(formData)) {
            fd.append(key, value);
        }
        return fd;
    }

    /**
     * Enable or disable the proxy
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    /**
     * Set the proxy URL
     */
    setProxyUrl(url: string): void {
        this.proxyUrl = url;
    }
}

/**
 * Global instance for easy access
 */
export const browserProxyFetch = new BrowserProxyFetch();

/**
 * Polyfill the global fetch function to use our proxy
 */
export function polyfillGlobalFetch(): void {
    if (typeof window !== 'undefined') {
        const originalFetch = window.fetch;

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            // Convert to our format
            const url = typeof input === 'string' ? input : input.toString();
            const method = (init?.method || 'GET') as "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
            const headers = init?.headers || {};
            const body = init?.body;

            // Parse body
            let jsonBody: any = undefined;
            let formUrlencoded: any = undefined;
            let formData: any = undefined;

            if (body) {
                if (typeof body === 'string') {
                    try {
                        jsonBody = JSON.parse(body);
                    } catch {
                        formUrlencoded = body;
                    }
                } else if (body instanceof FormData) {
                    formData = {};
                    // Use forEach instead of entries() for better compatibility
                    body.forEach((value, key) => {
                        formData[key] = value;
                    });
                }
            }

            const request: TMyfetchRequest = {
                url,
                method,
                headers: headers as Record<string, string>,
                jsonBody,
                formUrlencoded,
                formData,
            };

            try {
                const result = await browserProxyFetch.fetch(request);
                return new Response(JSON.stringify(result), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (error: any) {
                return new Response(JSON.stringify(error.json || { error: error.message }), {
                    status: error.status || 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        };
    }
} 