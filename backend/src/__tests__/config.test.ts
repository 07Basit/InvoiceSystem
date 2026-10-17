// config.ts exits the process on invalid settings, so each case loads a fresh copy with its own env.
function loadConfig(env: Record<string, string | undefined>) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  const exit = jest.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called');
  }) as never);
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    let loaded: typeof import('../config') | undefined;
    jest.isolateModules(() => {
      jest.doMock('dotenv/config', () => ({})); // don't let backend/.env refill the variables under test
      loaded = require('../config');
    });
    return { config: loaded!.config, exited: false, message: '' };
  } catch (e) {
    return { config: undefined, exited: (e as Error).message === 'process.exit called', message: String(error.mock.calls[0]?.[0] ?? '') };
  } finally {
    exit.mockRestore();
    error.mockRestore();
    process.env = saved;
  }
}

const strong = 'a'.repeat(64);

describe('production JWT secret guard', () => {
  it('refuses to start in production with the built-in dev secret', () => {
    const r = loadConfig({ NODE_ENV: 'production', JWT_SECRET: undefined });
    expect(r.exited).toBe(true);
    expect(r.message).toMatch(/JWT_SECRET/);
  });

  it('refuses to start in production with a secret shorter than 32 characters', () => {
    const r = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'only-24-characters-long!' });
    expect(r.exited).toBe(true);
  });

  it('starts in production with a strong secret', () => {
    const r = loadConfig({ NODE_ENV: 'production', JWT_SECRET: strong });
    expect(r.exited).toBe(false);
    expect(r.config?.JWT_SECRET).toBe(strong);
  });

  it('allows the dev default outside production', () => {
    const r = loadConfig({ NODE_ENV: 'development', JWT_SECRET: undefined });
    expect(r.exited).toBe(false);
  });

  it('refuses to start without a database URL', () => {
    const r = loadConfig({ DATABASE_URL: '' });
    expect(r.exited).toBe(true);
  });
});
