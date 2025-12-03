/**
 * DNS Manager Implementation
 *
 * Manages DNS records via Ganymede API.
 */

import { DNSManager } from '@holistix/gateway';
import { TMyfetchRequest } from '@holistix/simple-types';
import { log, EPriority } from '@holistix/log';

/**
 * DNS Manager Implementation
 * Calls Ganymede API for DNS operations
 */
export class DNSManagerImpl extends DNSManager {
  constructor(
    private readonly toGanymede: <T>(r: TMyfetchRequest) => Promise<T>
  ) {
    super();
  }

  /**
   * Register a DNS record (FQDN → IP)
   */
  async registerRecord(fqdn: string, ip: string): Promise<void> {
    log(EPriority.Info, 'DNS_MANAGER', `Registering DNS record: ${fqdn} → ${ip}`);

    try {
      await this.toGanymede({
        method: 'POST',
        url: '/gateway/dns/register',
        jsonBody: {
          fqdn,
          ip,
        },
      });

      log(EPriority.Info, 'DNS_MANAGER', `✅ DNS record registered: ${fqdn}`);
    } catch (error: any) {
      log(
        EPriority.Error,
        'DNS_MANAGER',
        `Failed to register DNS record ${fqdn}:`,
        error.message
      );
      throw new Error(`DNS registration failed: ${error.message}`);
    }
  }

  /**
   * Deregister a DNS record
   */
  async deregisterRecord(fqdn: string): Promise<void> {
    log(EPriority.Info, 'DNS_MANAGER', `Deregistering DNS record: ${fqdn}`);

    try {
      await this.toGanymede({
        method: 'DELETE',
        url: '/gateway/dns/deregister',
        jsonBody: {
          fqdn,
        },
      });

      log(EPriority.Info, 'DNS_MANAGER', `✅ DNS record deregistered: ${fqdn}`);
    } catch (error: any) {
      log(
        EPriority.Error,
        'DNS_MANAGER',
        `Failed to deregister DNS record ${fqdn}:`,
        error.message
      );
      // Don't throw - deregistration is best-effort
    }
  }
}
