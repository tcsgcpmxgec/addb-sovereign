import fs from 'fs';
import path from 'path';

/**
 * ADDB Self-Modification Engine
 * Allows the bot to autonomously modify its own codebase to apply fixes and improvements.
 */

export interface CodeChange {
  filePath: string;
  targetContent: string;
  replacementContent: string;
  description: string;
}

export async function applyCodeChange(change: CodeChange): Promise<{ success: boolean; message: string }> {
  try {
    const absolutePath = path.resolve(process.cwd(), change.filePath);
    
    // Security check: only allow modifying files within the project directory
    if (!absolutePath.startsWith(process.cwd())) {
      return { success: false, message: 'Security violation: Attempted to modify file outside project root.' };
    }

    if (!fs.existsSync(absolutePath)) {
      return { success: false, message: `File not found: ${change.filePath}` };
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    
    if (!content.includes(change.targetContent)) {
      return { success: false, message: 'Target content not found in file.' };
    }

    const newContent = content.replace(change.targetContent, change.replacementContent);
    fs.writeFileSync(absolutePath, newContent, 'utf8');

    console.log(`[SELF-MODIFICATION] Applied change to ${change.filePath}: ${change.description}`);
    return { success: true, message: `Successfully applied change to ${change.filePath}` };
  } catch (err: any) {
    console.error('[SELF-MODIFICATION] Error applying code change:', err);
    return { success: false, message: `Error: ${err.message}` };
  }
}
