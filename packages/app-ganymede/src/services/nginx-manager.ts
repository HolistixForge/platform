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
import { publicGatewayPath } from '@holistix-forge/types';

const execAsync = promisify(exec);

/**
 * Subdirectory holding the by-path form of each gateway config.
 *
 * A directory rather than a suffix in the same one, because the two are
 * included at different levels: the server blocks at http level, these inside
 * the public server block. An nginx glob does not cross a `/`, so
 * `nginx-gateways.d/*.conf` keeps matching only the server blocks.
 */
const PUBLIC_LOCATIONS_DIR = 'locations';

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

  private publicLocationsDir(): string {
    return path.join(this.nginxGatewaysDir, PUBLIC_LOCATIONS_DIR);
  }

  private publicLocationPath(orgId: string): string {
    return path.join(this.publicLocationsDir(), `org-${orgId}.conf`);
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
    //   - uc-{id}--{service}.org-{uuid}.{domain}
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
        # $http_host, not $host: the port the client asked for, kept.
        #
        # $host drops it, and this is the first hop — so every backend behind
        # this one that reflects its own address reflects it without a port,
        # whatever the gateway does further in. Measured: the auth guard put
        # \`https://jupyterlab.uc-….apollo.test/\` in its OAuth state and sent
        # the user there after login, to a port nothing listens on, on a
        # service that was running the whole time.
        proxy_set_header Host $http_host;
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

    // The same gateway, reachable a second way: as a path on whatever single
    // hostname the platform is being tunnelled on.
    //
    // A `location` and not another `server`, because there is no second
    // hostname to give a server block — that is the whole problem a tunnel
    // poses. It goes in a directory of its own so the public server block can
    // `include` just these, while the http-level include next to it keeps
    // picking up only the server blocks.
    //
    // The trailing slash on both the location and the proxy_pass is what
    // strips the prefix: the gateway sees `/collab/ping`, exactly as it does
    // when it is reached at `org-<uuid>.<domain>`, and needs to know nothing
    // about any of this.
    //
    // `^~` because the public server block also carries a regex location for
    // static assets, and nginx tries regexes before it settles on the longest
    // prefix — so without it any gateway path ending in .js or .css would be
    // looked for on the frontend's disk instead of proxied.
    const locationConfig = `# Gateway for organization ${orgId}, reached by path
# Auto-generated by Ganymede
# DO NOT EDIT MANUALLY

location ^~ ${publicGatewayPath(orgId)}/ {
    proxy_pass http://org-${orgId}-gw/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # $public_host, not $host: a tunnel daemon may rewrite Host to the origin
    # it dialled — "localhost:8443" — and the gateway decides same-origin by
    # comparing the browser's Origin to the host the request arrived on. The
    # variable is a map defined in the public server block that includes this
    # file, and holds the name the browser actually used.
    proxy_set_header Host $public_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Host $public_host;

    # WebSocket support
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
`;

    try {
      // Ensure directory exists
      await fs.promises.mkdir(this.nginxGatewaysDir, { recursive: true });
      await fs.promises.mkdir(this.publicLocationsDir(), { recursive: true });

      // Write config file
      await fs.promises.writeFile(configPath, nginxConfig, 'utf-8');
      await fs.promises.writeFile(
        this.publicLocationPath(orgId),
        locationConfig,
        'utf-8'
      );

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
      // Unconditionally, and before the check below returns: leaving this one
      // behind means the public server block still proxies the organization's
      // path to an upstream whose server block is gone — which nginx refuses
      // to load at all, taking every environment on this host down with it.
      await fs.promises.rm(this.publicLocationPath(orgId), { force: true });

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
