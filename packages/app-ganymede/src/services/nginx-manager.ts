/**
 * Nginx Configuration Manager
 *
 * Manages dynamic nginx configurations for gateway allocation.
 * Creates/removes server blocks for org-specific gateways.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EPriority, log } from '@holistix-forge/log';

const execAsync = promisify(exec);

export class NginxManager {
  private envName: string;
  private nginxGatewaysDir: string;
  private sslCertPath: string;
  private sslKeyPath: string;
  private logsDir: string;
  private listenPort: string;
  private testCommand: string;
  private reloadCommand: string;

  // Every value below keeps the address it has always had when nothing is set,
  // so a Linux environment behaves exactly as before. They are overridable
  // because the same class now also runs where none of those addresses exist:
  // on macOS nginx is Homebrew's, on 8443 because binding under 1024 needs
  // root, its configuration lives under the user's home rather than
  // /root/.local-dev, and Ganymede itself runs in a container — from which no
  // `nginx -s reload` can reach the nginx on the host.
  constructor() {
    this.envName = process.env.ENV_NAME || 'dev-001';
    // The Linux layout, and the fallback for the four paths below and nothing
    // else. A local rather than a field: kept as one it was dead on macOS,
    // where all four are overridden, and the next path derived from it without
    // an override of its own would have pointed silently into a directory that
    // does not exist there.
    const envDir = `/root/.local-dev/${this.envName}`;
    this.nginxGatewaysDir =
      process.env.NGINX_GATEWAYS_DIR || `${envDir}/nginx-gateways.d`;
    this.sslCertPath = process.env.NGINX_SSL_CERT || `${envDir}/ssl-cert.pem`;
    this.sslKeyPath = process.env.NGINX_SSL_KEY || `${envDir}/ssl-key.pem`;
    this.logsDir = process.env.NGINX_LOGS_DIR || `${envDir}/logs`;
    // Interpolated straight into `listen ${port} ssl;`. Operator configuration
    // rather than user input, so this is not an injection path — but a typo
    // becomes a generated block nginx refuses, and on the macOS layout that
    // refusal happens on the host, minutes and one confusing timeout later.
    // Refusing at startup names the actual mistake.
    const listenPort = process.env.NGINX_LISTEN_PORT || '443';
    // `< 1` and not just `> 65535`: `0` and `00000` are digits in range and
    // `listen 0 ssl;` is a directive nginx refuses — the delayed, confusing
    // host-side refusal this check exists to prevent.
    if (
      !/^\d{1,5}$/.test(listenPort) ||
      Number(listenPort) < 1 ||
      Number(listenPort) > 65535
    ) {
      throw new Error(
        `NGINX_LISTEN_PORT must be a port number, got: ${listenPort}`
      );
    }
    this.listenPort = listenPort;
    this.testCommand = process.env.NGINX_TEST_COMMAND || 'sudo nginx -t 2>&1';
    this.reloadCommand =
      process.env.NGINX_RELOAD_COMMAND || 'sudo nginx -s reload';
  }

  /**
   * Create nginx config for organization gateway
   * Routes org-{uuid}.domain.local and *.org-{uuid}.domain.local to gateway HTTP port
   */
  async createGatewayConfig(
    orgId: string,
    nginxUpstream: string
  ): Promise<void> {
    // Validate orgId to prevent path traversal
    if (!/^[a-f0-9-]{36}$/.test(orgId)) {
      throw new Error(`Invalid organization ID format: ${orgId}`);
    }

    // Validate nginxUpstream is provided
    if (!nginxUpstream || nginxUpstream.trim() === '') {
      throw new Error(
        `nginxUpstream is required for org ${orgId}. Must be explicitly provided from database.`
      );
    }

    // Without the port, always. DOMAIN carries one where nginx does not listen
    // on 443 — every URL built from it is a link somebody follows — and this
    // one use is not a URL: it becomes a `server_name`, which nginx matches
    // against the Host header with the port already taken off. A port here
    // produces a regex that matches nothing, so every org request falls
    // through to the default server and the gateway is simply never reached.
    const domain = (process.env.DOMAIN || 'domain.local').split(':')[0];
    const orgDomain = `org-${orgId}.${domain}`;
    const configPath = path.join(this.nginxGatewaysDir, `org-${orgId}.conf`);

    // The nginxUpstream is the address that Stage 1 Nginx (in main dev container or main VPS)
    // uses to reach the gateway container. Examples:
    //   Development: '172.17.0.1:7103' (Docker host via bridge gateway)
    //   Production single-server: '172.17.0.1:7103' (same as dev)
    //   Production multi-server: '10.0.0.20:7103' (cloud internal network)
    const gatewayAddress = nginxUpstream;

    log(
      EPriority.Info,
      'NGINX',
      `Creating config for ${orgDomain} → ${gatewayAddress}`
    );

    // Escape dots in domain for the regex server_name.
    // The result is embedded into a template that already treats `\.` as a
    // literal-dot matcher, so we must produce a SINGLE backslash here. Using
    // '\\\\.' (two backslashes) yields `domain\\.local`, which in PCRE means
    // "backslash + any char" and never matches the real hostname — silently
    // routing every org-*/uc-* request to the default (frontend) server.
    const domainEscaped = domain.replace(/\./g, '\\.');

    // Create nginx config (Stage 1: SSL termination, route to gateway)
    // Use regex server_name to match nested subdomains:
    //   - org-{uuid}.{domain}
    //   - uc-{id}.org-{uuid}.{domain}
    //   - {service}.uc-{id}.org-{uuid}.{domain}
    const nginxConfig = `# Gateway for organization ${orgId}
# Auto-generated by Ganymede
# DO NOT EDIT MANUALLY

upstream org-${orgId}-gw {
    server ${gatewayAddress};
}

server {
    listen ${this.listenPort} ssl;
    server_name ~^(.+\\.)?org-${orgId}\\.${domainEscaped}$;

    ssl_certificate ${this.sslCertPath};
    ssl_certificate_key ${this.sslKeyPath};

    location / {
        proxy_pass http://org-${orgId}-gw;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # WebSocket support
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    access_log ${this.logsDir}/gateway-${orgId}-access.log;
    error_log ${this.logsDir}/gateway-${orgId}-error.log;
}
`;

    try {
      // Ensure directory exists
      await fs.promises.mkdir(this.nginxGatewaysDir, { recursive: true });

      // Write config file
      await fs.promises.writeFile(configPath, nginxConfig, 'utf-8');

      log(EPriority.Info, 'NGINX', `✅ Config created: ${configPath}`);
    } catch (error: any) {
      log(
        EPriority.Error,
        'NGINX',
        `Failed to create config for org ${orgId}:`,
        error.message
      );
      throw new Error(`Nginx config creation failed: ${error.message}`);
    }
  }

  /**
   * Remove nginx config for organization gateway
   */
  async removeGatewayConfig(orgId: string): Promise<void> {
    // Validate orgId to prevent path traversal
    if (!/^[a-f0-9-]{36}$/.test(orgId)) {
      throw new Error(`Invalid organization ID format: ${orgId}`);
    }

    const configPath = path.join(this.nginxGatewaysDir, `org-${orgId}.conf`);

    log(EPriority.Info, 'NGINX', `Removing config for org ${orgId}`);

    try {
      // Check if file exists
      try {
        await fs.promises.access(configPath, fs.constants.F_OK);
      } catch {
        log(
          EPriority.Info,
          'NGINX',
          `Config doesn't exist for org ${orgId}, nothing to remove`
        );
        return;
      }

      // Remove config file
      await fs.promises.unlink(configPath);

      log(EPriority.Info, 'NGINX', `✅ Config removed: ${configPath}`);
    } catch (error: any) {
      log(
        EPriority.Error,
        'NGINX',
        `Failed to remove config for org ${orgId}:`,
        error.message
      );
      // Don't throw - removal is best-effort
    }
  }

  /**
   * Reload nginx to apply configuration changes
   */
  async reloadNginx(): Promise<void> {
    log(EPriority.Info, 'NGINX', 'Testing and reloading nginx...');

    try {
      // Test configuration first
      const { stdout: testOutput, stderr: testError } = await execAsync(
        this.testCommand
      );

      if (testError && !testOutput.includes('syntax is ok')) {
        log(EPriority.Critical, 'NGINX', `Config test failed: ${testError}`);
        throw new Error(`Nginx config test failed: ${testError}`);
      }

      // Reload nginx using nginx -s reload (more reliable than service command)
      await execAsync(this.reloadCommand);

      // Small delay to ensure reload command completes
      // Note: Actual readiness is verified via gateway health check in allocation flow
      await new Promise((resolve) => setTimeout(resolve, 200));

      log(EPriority.Info, 'NGINX', '✅ Nginx reloaded successfully');
    } catch (error: any) {
      log(
        EPriority.Critical,
        'NGINX',
        `Failed to reload nginx:`,
        error.message
      );
      throw new Error(`Nginx reload failed: ${error.message}`);
    }
  }

  /**
   * List all gateway configs
   */
  async listConfigs(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.nginxGatewaysDir);
      return files.filter((f) => f.endsWith('.conf'));
    } catch (error: any) {
      log(
        EPriority.Critical,
        'NGINX',
        `Failed to list configs:`,
        error.message
      );
      return [];
    }
  }
}

// Export singleton instance
export const nginxManager = new NginxManager();
