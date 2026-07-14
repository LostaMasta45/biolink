import type { CommandContext } from '../types';
import { COMMANDS } from '../command-processor';

// ============================================
// Command: !help
// Tampilkan semua command yang tersedia
// ============================================

export async function handleHelp(args: string[], context: CommandContext): Promise<string> {
  let helpText = `🤖 *COMMAND CENTER ILJ-HUB*
━━━━━━━━━━━━━━━━━━━━
Ketik command berikut di chat ini untuk menjalankannya.
Akun aktif: 📱 *${context.receiverLabel}*

`;

  for (const [name, cmd] of Object.entries(COMMANDS)) {
    const status = cmd.enabled ? '🟢' : '🔴';
    helpText += `${status} *${name}*\n`;
    helpText += `    ${cmd.description}\n`;
    helpText += `    Contoh: \`${cmd.usage}\`\n\n`;
  }

  helpText += `━━━━━━━━━━━━━━━━━━━━
💡 *TIPS:*
• Command harus diawali tanda seru (!)
• Kirim command ke chat nomor WA bisnis ini
• Semua command case-insensitive

🔗 Dashboard: ilj-hub.vercel.app/admin`;

  return helpText;
}
