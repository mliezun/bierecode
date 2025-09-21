import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { FullConfig } from '@playwright/test';

const PORT = Number(process.env.TEST_PORT ?? 8791);

const run = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) =>
  new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
    child.on('error', rejectRun);
  });

const waitForServer = async (url: string, server: ReturnType<typeof spawn>) => {
  const maxWaitMs = 30_000;
  const startedAt = Date.now();
  return new Promise<void>((resolveWait, rejectWait) => {
    let settled = false;

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (!settled) {
        settled = true;
        rejectWait(new Error(`Wrangler dev exited before becoming ready (code=${code} signal=${signal})`));
      }
    };

    server.once('exit', onExit);

    (async () => {
      while (!settled && Date.now() - startedAt < maxWaitMs) {
        try {
          const res = await fetch(url, { method: 'HEAD' });
          if (res.ok || res.status >= 200) {
            settled = true;
            server.off('exit', onExit);
            resolveWait();
            return;
          }
        } catch (error) {
          // ignore while server starts
        }
        await delay(250);
      }
      if (!settled) {
        settled = true;
        server.off('exit', onExit);
        rejectWait(new Error('Timed out waiting for Wrangler dev server'));
      }
    })().catch((error) => {
      if (!settled) {
        settled = true;
        server.off('exit', onExit);
        rejectWait(error);
      }
    });
  });
};

const attemptSignup = async (baseURL: string, email: string, password: string) => {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`${baseURL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Playwright Admin' }),
    });

    console.log(`[playwright] signUp attempt ${attempt + 1} -> ${response.status}`);
    if (response.ok) {
      const cloned = response.clone();
      try {
        const payload = await cloned.json();
        console.log(`[playwright] signUp success id=${payload?.user?.id ?? 'unknown'}`);
      } catch (error) {
        console.log('[playwright] signUp success without body');
      }
      return response;
    }
    if (response.status === 422) {
      console.log('[playwright] signUp received 422');
      return response;
    }

    const body = await response.text();
    if (attempt === maxAttempts - 1) {
      throw new Error(`Unable to seed admin account: ${response.status} ${body}`);
    }
    await delay(1000);
  }
  throw new Error('Unable to seed admin account after retries');
};

export default async function globalSetup(_config: FullConfig) {
  const projectRoot = resolve('.');
  const persistPath = mkdtempSync(join(tmpdir(), 'wrangler-e2e-'));
  const stateDir = join(projectRoot, '.playwright');
  mkdirSync(stateDir, { recursive: true });
  const stateFile = join(stateDir, 'wrangler-state.json');

  const sharedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    WRANGLER_PERSIST_TO: persistPath,
  };

  console.log(`[playwright] Using Wrangler persist directory: ${persistPath}`);

  await run('npx', ['--yes', 'playwright', 'install', 'chromium'], { cwd: projectRoot, env: sharedEnv });

  await run('npm', ['run', 'build'], { cwd: projectRoot, env: sharedEnv });
  await run('npx', ['--yes', 'wrangler', 'd1', 'migrations', 'apply', 'bierecode-auth', '--local', '--persist-to', persistPath], {
    cwd: projectRoot,
    env: sharedEnv,
  });

  const server = spawn('npx', ['--yes', 'wrangler', 'pages', 'dev', './dist', '--port', String(PORT), '--persist-to', persistPath], {
    cwd: projectRoot,
    env: sharedEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  server.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  const baseURL = `http://127.0.0.1:${PORT}`;
  await waitForServer(baseURL, server);

  const ensureSchema = async () => {
    try {
      await run('npx', ['--yes', 'wrangler', 'd1', 'execute', 'bierecode-auth', '--local', '--persist-to', persistPath, '--command', "SELECT name FROM sqlite_master WHERE name = 'user';"], {
        cwd: projectRoot,
        env: sharedEnv,
      });
    } catch {
      await run('npx', ['--yes', 'wrangler', 'd1', 'migrations', 'apply', 'bierecode-auth', '--local', '--persist-to', persistPath], {
        cwd: projectRoot,
        env: sharedEnv,
      });
      await run('npx', ['--yes', 'wrangler', 'd1', 'execute', 'bierecode-auth', '--local', '--persist-to', persistPath, '--command', "SELECT name FROM sqlite_master WHERE name = 'user';"], {
        cwd: projectRoot,
        env: sharedEnv,
      });
    }
  };

  await ensureSchema();

  const stopServer = async () => {
    const pid = server.pid;
    if (!pid) return;
    const groupPid = -Math.abs(pid);
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
  };

  const adminEmail = `playwright-admin-${Date.now()}@bierecode.test`;
  const adminPassword = 'Test12345!';

  let signupResponse: Response;
  try {
    await delay(500);
    signupResponse = await attemptSignup(baseURL, adminEmail, adminPassword);
  } catch (error) {
    await stopServer();
    throw error;
  }

  await run('npx', ['--yes', 'wrangler', 'd1', 'execute', 'bierecode-auth', '--local', '--persist-to', persistPath, '--command', `UPDATE user SET role = 'admin' WHERE email = '${adminEmail}';`], {
    cwd: projectRoot,
    env: sharedEnv,
  });

  writeFileSync(
    stateFile,
    JSON.stringify(
      {
        pid: server.pid,
        persistPath,
        baseURL,
        adminEmail,
        adminPassword,
      },
      null,
      2,
    ),
  );

  process.env.PLAYWRIGHT_WRANGLER_STATE = stateFile;
  process.env.TEST_BASE_URL = baseURL;
  process.env.TEST_ADMIN_EMAIL = adminEmail;
  process.env.TEST_ADMIN_PASSWORD = adminPassword;

  console.log(`[playwright] Seeded admin ${adminEmail}`);

  server.unref();
}

