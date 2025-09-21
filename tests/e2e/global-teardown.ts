import { readFileSync, rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

export default async function globalTeardown() {
  const statePath = process.env.PLAYWRIGHT_WRANGLER_STATE;
  if (!statePath) return;

  let state: {
    pid?: number;
    persistPath?: string;
  };

  try {
    state = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch (error) {
    return;
  }

  if (state.pid) {
    const groupPid = -Math.abs(state.pid);
    try {
      process.kill(groupPid, 'SIGTERM');
      await delay(500);
    } catch (error) {
      // ignore
    }
    try {
      process.kill(groupPid, 'SIGKILL');
    } catch (error) {
      // ignore
    }
  }

  if (state.persistPath) {
    try {
      rmSync(state.persistPath, { recursive: true, force: true });
    } catch (error) {
      // ignore
    }
  }
}
