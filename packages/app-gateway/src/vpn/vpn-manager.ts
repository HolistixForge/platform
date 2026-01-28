import * as fs from 'fs';
import { spawnSync } from 'child_process';
import { EPriority, log } from '@holistix-forge/log';

interface VpnConfig {
  organization_id: string;
  status: string;
  pid: number;
  temp_dir: string;
  port: number;
  hostname: string;
  certificates: Record<string, string>;
}

const VPN_CONFIG_PATH = '/tmp/vpn-config.json';

export function loadVpnConfig(): VpnConfig | null {
  if (!fs.existsSync(VPN_CONFIG_PATH)) {
    return null;
  }

  try {
    const data = fs.readFileSync(VPN_CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    log(
      EPriority.Warning,
      'VPN',
      `Failed to load VPN config: ${error.message}`
    );
    return null;
  }
}

export function isVpnValidForOrg(
  vpnConfig: VpnConfig | null,
  organization_id: string
): boolean {
  if (!vpnConfig) return false;
  if (vpnConfig.organization_id !== organization_id) return false;
  if (vpnConfig.status !== 'ok') return false;

  try {
    process.kill(vpnConfig.pid, 0);
    return true;
  } catch {
    log(EPriority.Warning, 'VPN', 'VPN process dead, cleaning up stale config');
    stopVpn();
    return false;
  }
}

export function stopVpn(): void {
  const vpnConfig = loadVpnConfig();

  if (!vpnConfig) {
    log(EPriority.Info, 'VPN', 'No VPN to stop');
    return;
  }

  log(
    EPriority.Info,
    'VPN',
    `Stopping VPN for org ${vpnConfig.organization_id}...`
  );

  try {
    const result = spawnSync('/opt/gateway/app/lib/stop-vpn.sh', [], {
      env: process.env, // Pass environment for consistency (though not strictly needed)
      stdio: 'pipe',
      timeout: 10000,
    });

    if (result.error) {
      log(
        EPriority.Warning,
        'VPN',
        `Failed to stop VPN: ${result.error.message}`
      );
    } else if (result.status !== 0) {
      const stderr = result.stderr?.toString() || '';
      log(EPriority.Warning, 'VPN', `VPN stop script failed: ${stderr}`);
    } else {
      log(EPriority.Info, 'VPN', '✅ VPN stopped and cleaned up');
    }
  } catch (error: any) {
    log(EPriority.Warning, 'VPN', `Failed to stop VPN: ${error.message}`);
  }
}

export async function startVpnAsync(organization_id: string): Promise<void> {
  log(EPriority.Info, 'VPN', `Starting VPN for org ${organization_id}...`);

  // Defer to next tick to avoid blocking the event loop
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      const result = spawnSync('/opt/gateway/app/lib/start-vpn.sh', [], {
        env: { ...process.env, ORGANIZATION_ID: organization_id },
        stdio: 'pipe',
        timeout: 60000,
      });

      if (result.error) {
        log(
          EPriority.Error,
          'VPN',
          `VPN setup failed: ${result.error.message}`
        );
        reject(result.error);
        return;
      }

      if (result.status !== 0) {
        const stderr = result.stderr?.toString() || '';
        log(EPriority.Error, 'VPN', `VPN setup failed: ${stderr}`);
        reject(new Error(`VPN setup exited with code ${result.status}`));
        return;
      }

      log(EPriority.Info, 'VPN', '✅ VPN started successfully');
      resolve();
    });
  });
}
