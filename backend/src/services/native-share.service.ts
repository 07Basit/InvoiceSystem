import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { config } from '../config';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

const run = promisify(execFile);

const SHARE_DIR = join(tmpdir(), 'invoice-share');
const KEEP_MS = 24 * 60 * 60 * 1000;

/** Mail with the file attached: a new, unsent message the user addresses and sends. */
const MAIL_SCRIPT = [
  'on run argv',
  'set theSubject to item 1 of argv',
  'set theBody to item 2 of argv',
  'set theFile to item 3 of argv',
  'tell application "Mail"',
  'set newMessage to make new outgoing message with properties {subject:theSubject, content:theBody & return & return, visible:true}',
  'tell newMessage',
  'make new attachment with properties {file name:(POSIX file theFile as alias)} at after the last paragraph',
  'end tell',
  'set attachedCount to count of attachments of newMessage',
  'activate',
  'end tell',
  'return attachedCount',
  'end run',
];

/**
 * Puts the file on the clipboard the way Finder does, so a chat or email accepts it with Cmd+V.
 * With a second argument the message text rides along as well: one clipboard, both kinds of content.
 */
const CLIPBOARD_SCRIPT = [
  'on run argv',
  'set theFile to item 1 of argv',
  'if (count of argv) > 1 then',
  'set the clipboard to {«class furl»:(POSIX file theFile), string:(item 2 of argv)}',
  'else',
  'set the clipboard to (POSIX file theFile)',
  'end if',
  'end run',
];

/** The owner's switch: "auto" is development only, "on" forces it, "off" never. */
function allowed(): boolean {
  if (config.NATIVE_SHARE === 'off') return false;
  if (config.NATIVE_SHARE === 'on') return true;
  return config.NODE_ENV !== 'production';
}

export const nativeShare = {
  /** Mail / WhatsApp helpers: a Mac only, and only where the owner allows it. */
  isAvailable(): boolean {
    return process.platform === 'darwin' && allowed();
  },

  /** Copying the file to the clipboard: a Mac or a Windows PC running the server, where the owner allows it. */
  supportsFileClipboard(): boolean {
    return (process.platform === 'darwin' || process.platform === 'win32') && allowed();
  },

  /**
   * True only for requests made from this very computer. When the dev server proxies a request (for example a
   * phone on the same Wi-Fi), the connection itself looks local, so the original client in X-Forwarded-For counts too.
   */
  isLocalRequest(remoteAddress: string | undefined, forwardedFor?: string | string[] | undefined): boolean {
    const isLoopback = (a: string | undefined) => a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
    if (!isLoopback(remoteAddress)) return false;
    const chain = (Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor ?? '').split(',').map((a) => a.trim()).filter(Boolean);
    return chain.every(isLoopback);
  },

  /** Writes the file into a private temp folder (removing old ones) and returns its path. */
  async writeTempFile(filename: string, bytes: Uint8Array | Buffer): Promise<string> {
    await mkdir(SHARE_DIR, { recursive: true });
    await nativeShare.cleanup();
    const dir = join(SHARE_DIR, randomUUID());
    await mkdir(dir, { recursive: true });
    const path = join(dir, filename);
    await writeFile(path, bytes);
    return path;
  },

  async cleanup(now = Date.now()): Promise<void> {
    try {
      for (const name of await readdir(SHARE_DIR)) {
        const dir = join(SHARE_DIR, name);
        if (now - (await stat(dir)).mtimeMs > KEEP_MS) await rm(dir, { recursive: true, force: true });
      }
    } catch {
      // nothing to clean
    }
  },

  async osascript(lines: string[], args: string[]): Promise<string> {
    const flags = lines.flatMap((line) => ['-e', line]);
    try {
      const { stdout } = await run('osascript', [...flags, ...args], { timeout: 30_000 });
      return String(stdout ?? '').trim();
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr ?? '';
      const text = `${error instanceof Error ? error.message.split('\n')[0] : String(error)} ${stderr}`.trim();
      logger.warn('osascript failed', { error: text, action: 'native_share' });
      if (/-1743|not allowed|not authorized/i.test(text)) {
        throw new AppError('macOS is blocking this. Allow the terminal running the server to control Mail: System Settings → Privacy & Security → Automation.', 500, 'NATIVE_SHARE_NOT_ALLOWED');
      }
      if (error instanceof Error && ('killed' in error && (error as { killed?: boolean }).killed || /timed out/i.test(text))) {
        throw new AppError('Nothing happened. If macOS asked for permission to control Mail, click Allow and try again.', 500, 'NATIVE_SHARE_TIMEOUT');
      }
      throw new AppError('Could not open the app on this computer.', 500, 'NATIVE_SHARE_FAILED');
    }
  },

  /** Puts the file itself on the clipboard (as Finder or Explorer does), so Cmd/Ctrl+V attaches it in an email or chat. */
  async copyFile(path: string, text?: string): Promise<void> {
    if (process.platform === 'win32') {
      try {
        await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -LiteralPath $env:INVOICE_SHARE_FILE'], { timeout: 15_000, env: { ...process.env, INVOICE_SHARE_FILE: path } });
      } catch (error) {
        logger.warn('Could not copy file to the clipboard', { error: error instanceof Error ? error.message : String(error), action: 'native_share' });
        throw new AppError('Could not copy the file to the clipboard.', 500, 'NATIVE_SHARE_FAILED');
      }
      return;
    }
    await nativeShare.osascript(CLIPBOARD_SCRIPT, text ? [path, text] : [path]);
  },

  /** Opens a new Mail message with the subject, body and the file attached. */
  async mail(path: string, subject: string, body: string): Promise<void> {
    const attached = await nativeShare.osascript(MAIL_SCRIPT, [subject, body, path]);
    // Mail itself reports how many files the new message holds: never claim success without the file
    if (attached !== '1') throw new AppError('Mail opened, but the file could not be attached.', 500, 'NATIVE_SHARE_NO_ATTACHMENT');
  },

  /**
   * Copies the file to the clipboard and opens WhatsApp's chat list with the message typed in;
   * the user picks a chat and presses Cmd+V to attach the file. Returns whether the desktop app opened.
   */
  async whatsapp(path: string, text: string): Promise<'app' | 'none'> {
    await nativeShare.osascript(CLIPBOARD_SCRIPT, [path]);
    try {
      await run('open', [`whatsapp://send?text=${encodeURIComponent(text)}`], { timeout: 10_000 });
      return 'app';
    } catch {
      return 'none'; // WhatsApp desktop is not installed; the browser flow takes over and the file is still on the clipboard
    }
  },
};
