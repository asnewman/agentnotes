import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export async function openEditor(initialContent = ''): Promise<string | undefined> {
  const editor = process.env.EDITOR || 'vi';
  const tmpFile = path.join(os.tmpdir(), `agentnotes-${Date.now()}.md`);

  try {
    fs.writeFileSync(tmpFile, initialContent, 'utf-8');
    execSync(`${editor} "${tmpFile}"`, { stdio: 'inherit' });
    const content = fs.readFileSync(tmpFile, 'utf-8').trim();
    return content || undefined;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup errors
    }
  }
}
