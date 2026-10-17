import { readFile, utimes } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileMock = jest.fn();
jest.mock('node:child_process', () => ({ execFile: (...args: unknown[]) => execFileMock(...args) }));

import { config } from '../config';
import { nativeShare } from '../services/native-share.service';

const ok = (stdout = '1') => execFileMock.mockImplementation((...args: unknown[]) => (args[args.length - 1] as (e: Error | null, r: object) => void)(null, { stdout, stderr: '' }));
const platform = (value: string) => Object.defineProperty(process, 'platform', { value, configurable: true });
const realPlatform = process.platform;
const original = { NATIVE_SHARE: config.NATIVE_SHARE, NODE_ENV: config.NODE_ENV };

afterEach(() => {
  execFileMock.mockReset();
  platform(realPlatform);
  Object.assign(config, original);
});

describe('nativeShare.isAvailable', () => {
  it('is only ever on for macOS', () => {
    platform('linux');
    Object.assign(config, { NATIVE_SHARE: 'on', NODE_ENV: 'development' });
    expect(nativeShare.isAvailable()).toBe(false);
  });
  it('auto means development only', () => {
    platform('darwin');
    Object.assign(config, { NATIVE_SHARE: 'auto', NODE_ENV: 'development' });
    expect(nativeShare.isAvailable()).toBe(true);
    Object.assign(config, { NODE_ENV: 'production' });
    expect(nativeShare.isAvailable()).toBe(false);
  });
  it('can be forced on or off', () => {
    platform('darwin');
    Object.assign(config, { NATIVE_SHARE: 'on', NODE_ENV: 'production' });
    expect(nativeShare.isAvailable()).toBe(true);
    Object.assign(config, { NATIVE_SHARE: 'off', NODE_ENV: 'development' });
    expect(nativeShare.isAvailable()).toBe(false);
  });
});

describe('nativeShare.supportsFileClipboard', () => {
  it('works on a Mac or a Windows PC, but never on other systems or when switched off', () => {
    Object.assign(config, { NATIVE_SHARE: 'auto', NODE_ENV: 'development' });
    platform('darwin');
    expect(nativeShare.supportsFileClipboard()).toBe(true);
    platform('win32');
    expect(nativeShare.supportsFileClipboard()).toBe(true);
    platform('linux');
    expect(nativeShare.supportsFileClipboard()).toBe(false);
    platform('win32');
    Object.assign(config, { NATIVE_SHARE: 'off' });
    expect(nativeShare.supportsFileClipboard()).toBe(false);
    Object.assign(config, { NATIVE_SHARE: 'auto', NODE_ENV: 'production' });
    expect(nativeShare.supportsFileClipboard()).toBe(false);
  });
});

describe('nativeShare.isLocalRequest', () => {
  it('accepts only loopback addresses', () => {
    for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) expect(nativeShare.isLocalRequest(a)).toBe(true);
    for (const a of ['192.168.1.20', '10.0.0.5', '::ffff:8.8.8.8', undefined]) expect(nativeShare.isLocalRequest(a)).toBe(false);
  });

  it('refuses a phone whose request arrives through the local dev proxy', () => {
    expect(nativeShare.isLocalRequest('127.0.0.1', '192.168.1.55')).toBe(false);
    expect(nativeShare.isLocalRequest('::ffff:127.0.0.1', '::ffff:192.168.1.55')).toBe(false);
    expect(nativeShare.isLocalRequest('127.0.0.1', '127.0.0.1, 10.0.0.9')).toBe(false);
  });

  it('still allows this computer through the dev proxy', () => {
    expect(nativeShare.isLocalRequest('127.0.0.1', '::1')).toBe(true);
    expect(nativeShare.isLocalRequest('::1', ['127.0.0.1'])).toBe(true);
    expect(nativeShare.isLocalRequest('127.0.0.1', undefined)).toBe(true);
  });
});

describe('nativeShare.mail', () => {
  it('passes subject, body and path as separate arguments (never joined into the script)', async () => {
    ok();
    await nativeShare.mail('/tmp/x/invoice-1.pdf', 'Invoice "A" & $(rm -rf /)', 'Body; `whoami`');
    const [cmd, args] = execFileMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('osascript');
    expect(args.slice(-3)).toEqual(['Invoice "A" & $(rm -rf /)', 'Body; `whoami`', '/tmp/x/invoice-1.pdf']);
    const script = args.filter((_, i) => args[i - 1] === '-e').join('\n');
    expect(script).toContain('make new attachment');
    expect(script).not.toContain('whoami');
    expect(script).not.toContain('rm -rf');
  });

  it('refuses to report success when Mail did not end up with the file', async () => {
    ok('0');
    await expect(nativeShare.mail('/tmp/a.pdf', 's', 'b')).rejects.toMatchObject({ code: 'NATIVE_SHARE_NO_ATTACHMENT' });
  });

  it('explains how to fix a macOS permission block', async () => {
    execFileMock.mockImplementation((...args: unknown[]) => (args[args.length - 1] as (e: Error) => void)(new Error('Not authorized to send Apple events to Mail. (-1743)')));
    await expect(nativeShare.mail('/tmp/a.pdf', 's', 'b')).rejects.toMatchObject({ code: 'NATIVE_SHARE_NOT_ALLOWED' });
  });

  it('tells you to approve the macOS prompt when nothing answers in time', async () => {
    execFileMock.mockImplementation((...args: unknown[]) => (args[args.length - 1] as (e: Error) => void)(Object.assign(new Error('Command failed'), { killed: true })));
    await expect(nativeShare.mail('/tmp/a.pdf', 's', 'b')).rejects.toMatchObject({ code: 'NATIVE_SHARE_TIMEOUT' });
  });

  it('reports any other failure plainly', async () => {
    execFileMock.mockImplementation((...args: unknown[]) => (args[args.length - 1] as (e: Error) => void)(new Error('boom')));
    await expect(nativeShare.mail('/tmp/a.pdf', 's', 'b')).rejects.toMatchObject({ code: 'NATIVE_SHARE_FAILED' });
  });
});

describe('nativeShare.copyFile', () => {
  it('on a Mac puts the file on the clipboard with AppleScript, passing the path as an argument', async () => {
    platform('darwin');
    ok();
    await nativeShare.copyFile('/tmp/x/invoice 1.pdf');
    const [cmd, args] = execFileMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('osascript');
    expect(args[args.length - 1]).toBe('/tmp/x/invoice 1.pdf');
    expect(args.join(' ')).toContain('set the clipboard to');
  });

  it('on Windows uses PowerShell, handing the path over in an environment variable (never in the command)', async () => {
    platform('win32');
    ok();
    await nativeShare.copyFile("C:\\Temp\\x'; calc; '\\invoice.pdf");
    const [cmd, args, options] = execFileMock.mock.calls[0] as [string, string[], { env: Record<string, string> }];
    expect(cmd).toBe('powershell');
    expect(args.join(' ')).toContain('Set-Clipboard -LiteralPath $env:INVOICE_SHARE_FILE');
    expect(args.join(' ')).not.toContain('calc');
    expect(options.env['INVOICE_SHARE_FILE']).toContain('calc');
  });

  it('reports a failed copy plainly', async () => {
    platform('win32');
    execFileMock.mockImplementation((...args: unknown[]) => (args[args.length - 1] as (e: Error) => void)(new Error('boom')));
    await expect(nativeShare.copyFile('C:\\a.pdf')).rejects.toMatchObject({ code: 'NATIVE_SHARE_FAILED' });
  });
});

describe('nativeShare.whatsapp', () => {
  it('copies the file, then opens WhatsApp with the text', async () => {
    ok();
    await expect(nativeShare.whatsapp('/tmp/a.pdf', 'Hi & bye')).resolves.toBe('app');
    expect(execFileMock.mock.calls[0]![0]).toBe('osascript');
    expect(execFileMock.mock.calls[0]![1]).toContain('/tmp/a.pdf');
    expect(execFileMock.mock.calls[1]![0]).toBe('open');
    expect(execFileMock.mock.calls[1]![1]).toEqual(['whatsapp://send?text=Hi%20%26%20bye']);
  });

  it('reports "none" when the desktop app is not installed, with the file already on the clipboard', async () => {
    execFileMock.mockImplementation((cmd: string, _a: unknown, _o: unknown, cb: (e: Error | null, r?: object) => void) => (cmd === 'open' ? cb(new Error('no app')) : cb(null, { stdout: '' })));
    await expect(nativeShare.whatsapp('/tmp/a.pdf', 'Hi')).resolves.toBe('none');
  });
});

describe('temp files', () => {
  it('writes the file into a private folder and removes old ones', async () => {
    const path = await nativeShare.writeTempFile('invoice-1.pdf', Buffer.from('%PDF-test'));
    expect((await readFile(path)).toString()).toBe('%PDF-test');
    expect(path.startsWith(tmpdir())).toBe(true);

    const dir = join(path, '..');
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await utimes(dir, old, old);
    await nativeShare.cleanup();
    expect(existsSync(dir)).toBe(false);
  });
});
