/**
 * PowerDNS API Client
 *
 * Manages DNS records via PowerDNS REST API for dynamic gateway allocation.
 * All gateways (org-{uuid}.domain.com) and user containers (uc-{uuid}.org-{uuid}.domain.com), etc.
 * are registered here to route requests through the main nginx (stage 1).
 */

import axios, { AxiosInstance } from 'axios';
import { EPriority, log } from '@monorepo/log';

export interface PowerDNSRecord {
  content: string; // IP address
  disabled: boolean;
  ttl?: number;
}

export interface PowerDNSRRSet {
  name: string; // FQDN with trailing dot
  type: string; // A, AAAA, CNAME, etc.
  changetype: 'REPLACE' | 'DELETE';
  ttl: number;
  records: PowerDNSRecord[];
}

export class PowerDNSClient {
  private client: AxiosInstance;
  private domain: string;
  private zoneName: string;

  constructor() {
    const apiUrl = process.env.POWERDNS_API_URL || 'http://localhost:8081';
    const apiKey = process.env.POWERDNS_API_KEY || 'local-dev-api-key';
    this.domain = process.env.DOMAIN || 'domain.local';
    this.zoneName = `${this.domain}.`;

    this.client = axios.create({
      baseURL: `${apiUrl}/api/v1`,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    log(
      6,
      'POWERDNS',
      `Initialized PowerDNS client for zone: ${this.zoneName}`
    );
  }

  /**
   * Register a gateway's domain (org-{uuid}.domain.com)
   * Points to the dev container IP (127.0.0.1 for local dev)
   */
  async registerGateway(orgId: string): Promise<void> {
    const fqdn = `org-${orgId}.${this.domain}.`;
    const ip = process.env.DEV_CONTAINER_IP || '127.0.0.1';

    log(6, 'POWERDNS', `Registering gateway: ${fqdn} → ${ip}`);

    try {
      await this.client.patch(`/servers/localhost/zones/${this.zoneName}`, {
        rrsets: [
          {
            name: fqdn,
            type: 'A',
            changetype: 'REPLACE',
            ttl: 60,
            records: [
              {
                content: ip,
                disabled: false,
              },
            ],
          },
        ],
      });

      log(6, 'POWERDNS', `✅ Gateway registered: ${fqdn}`);
    } catch (error: any) {
      log(
        EPriority.Error,
        'POWERDNS',
        `❌ Failed to register gateway ${fqdn}:`,
        error.message
      );
      throw new Error(`PowerDNS registration failed: ${error.message}`);
    }
  }

  /**
   * Deregister a gateway's domain (remove A record)
   */
  async deregisterGateway(orgId: string): Promise<void> {
    const fqdn = `org-${orgId}.${this.domain}.`;

    log(6, 'POWERDNS', `Deregistering gateway: ${fqdn}`);

    try {
      await this.client.patch(`/servers/localhost/zones/${this.zoneName}`, {
        rrsets: [
          {
            name: fqdn,
            type: 'A',
            changetype: 'DELETE',
          },
        ],
      });

      log(6, 'POWERDNS', `✅ Gateway deregistered: ${fqdn}`);
    } catch (error: any) {
      log(
        EPriority.Error,
        'POWERDNS',
        `❌ Failed to deregister gateway ${fqdn}:`,
        error.message
      );
      // Don't throw - deregistration is best-effort
    }
  }

  /**
   * Register a DNS record (FQDN → IP)
   * @param fqdn - Fully qualified domain name (e.g., "uc-xyz.org-abc.domain.local")
   * @param ip - IP address to point to (e.g., "127.0.0.1" or public IP)
   */
  async registerRecord(fqdn: string, ip: string): Promise<void> {
    // Ensure FQDN ends with trailing dot
    const fqdnWithDot = fqdn.endsWith('.') ? fqdn : `${fqdn}.`;

    log(6, 'POWERDNS', `Registering DNS record: ${fqdnWithDot} → ${ip}`);

    try {
      await this.client.patch(`/servers/localhost/zones/${this.zoneName}`, {
        rrsets: [
          {
            name: fqdnWithDot,
            type: 'A',
            changetype: 'REPLACE',
            ttl: 60,
            records: [
              {
                content: ip,
                disabled: false,
              },
            ],
          },
        ],
      });

      log(6, 'POWERDNS', `✅ DNS record registered: ${fqdnWithDot}`);
    } catch (error: any) {
      log(
        EPriority.Error,
        'POWERDNS',
        `❌ Failed to register DNS record ${fqdnWithDot}:`,
        error.message
      );
      throw new Error(`PowerDNS registration failed: ${error.message}`);
    }
  }

  /**
   * Deregister a DNS record
   * @param fqdn - Fully qualified domain name to remove
   */
  async deregisterRecord(fqdn: string): Promise<void> {
    // Ensure FQDN ends with trailing dot
    const fqdnWithDot = fqdn.endsWith('.') ? fqdn : `${fqdn}.`;

    log(6, 'POWERDNS', `Deregistering DNS record: ${fqdnWithDot}`);

    try {
      await this.client.patch(`/servers/localhost/zones/${this.zoneName}`, {
        rrsets: [
          {
            name: fqdnWithDot,
            type: 'A',
            changetype: 'DELETE',
          },
        ],
      });

      log(6, 'POWERDNS', `✅ DNS record deregistered: ${fqdnWithDot}`);
    } catch (error: any) {
      log(
        EPriority.Error,
        'POWERDNS',
        `❌ Failed to deregister DNS record ${fqdnWithDot}:`,
        error.message
      );
      // Don't throw - deregistration is best-effort
    }
  }

  /**
   * List all DNS records in the zone (useful for debugging)
   */
  async listRecords(): Promise<any> {
    try {
      const response = await this.client.get(
        `/servers/localhost/zones/${this.zoneName}`
      );
      return response.data;
    } catch (error: any) {
      log(
        EPriority.Error,
        'POWERDNS',
        `Failed to list records:`,
        error.message
      );
      throw error;
    }
  }
}

// Export singleton instance
export const powerDNS = new PowerDNSClient();
