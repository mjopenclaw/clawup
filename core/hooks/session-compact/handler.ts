import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

interface HookEvent {
  type: string;
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: string[];
  context: {
    sessionEntry?: any;
    sessionId?: string;
    sessionFile?: string;
    commandSource?: string;
    senderId?: string;
    workspaceDir?: string;
    cfg?: any;
  };
}

type HookHandler = (event: HookEvent) => Promise<void>;

// 프레임워크 DB 사용 (없으면 생성)
const FRAMEWORK_DIR = join(homedir(), 'projects/openclaw-framework');
const DB_PATH = join(FRAMEWORK_DIR, 'data/framework.db');

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function extractFromTranscript(transcriptPath: string): {
  summary: string;
  topics: string[];
  messageCount: number;
} {
  if (!existsSync(transcriptPath)) {
    return { summary: '', topics: [], messageCount: 0 };
  }

  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.split('\n');
    
    // 메시지 수 계산 (user/assistant 턴)
    const messageCount = lines.filter(l => 
      l.includes('"role":"user"') || l.includes('"role":"assistant"')
    ).length;

    // 마지막 N개 메시지에서 핵심 추출 (간단 버전)
    const recentLines = lines.slice(-50);
    const userMessages: string[] = [];
    
    for (const line of recentLines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.role === 'user' && typeof parsed.content === 'string') {
          userMessages.push(parsed.content.slice(0, 200));
        }
      } catch {
        // skip non-JSON lines
      }
    }

    // 간단한 요약 (실제로는 LLM 호출 권장)
    const summary = userMessages.slice(-5).join(' | ').slice(0, 500);
    
    // 주제 추출 (키워드 기반)
    const allText = userMessages.join(' ').toLowerCase();
    const topics: string[] = [];
    
    const keywords = ['cron', 'hook', 'config', 'agents', 'memory', 'context', 
                      'compile', 'mdx', 'sqlite', 'db', 'twitter', 'x', 'threads'];
    for (const kw of keywords) {
      if (allText.includes(kw)) topics.push(kw);
    }

    return { summary, topics, messageCount };
  } catch (err) {
    console.error('[session-compact] Error reading transcript:', err);
    return { summary: '', topics: [], messageCount: 0 };
  }
}

const handler: HookHandler = async (event) => {
  // command:new 또는 command:reset 만 처리
  if (event.type !== 'command' || !['new', 'reset'].includes(event.action)) {
    return;
  }

  const sessionKey = event.sessionKey;
  const sessionFile = event.context.sessionFile;
  const source = event.context.commandSource || 'unknown';

  console.log(`[session-compact] Saving context for session: ${sessionKey}`);

  if (!sessionFile || !existsSync(sessionFile)) {
    console.log('[session-compact] No session file found, skipping');
    return;
  }

  try {
    const { summary, topics, messageCount } = extractFromTranscript(sessionFile);

    if (!summary || messageCount < 2) {
      console.log('[session-compact] Not enough content to save');
      return;
    }

    // SQLite에 저장
    const sql = `INSERT INTO session_summaries 
      (session_key, summary, topics, message_count, source) 
      VALUES (
        '${escapeSQL(sessionKey)}',
        '${escapeSQL(summary)}',
        '${escapeSQL(topics.join(','))}',
        ${messageCount},
        '${escapeSQL(source)}'
      )`;

    execSync(`sqlite3 "${DB_PATH}" "${sql}"`, { encoding: 'utf-8' });
    
    console.log(`[session-compact] Saved: ${messageCount} messages, topics: ${topics.join(', ')}`);
    event.messages.push(`🧠 Context saved (${messageCount} messages)`);

  } catch (err) {
    console.error('[session-compact] Error saving context:', err);
  }
};

export default handler;
