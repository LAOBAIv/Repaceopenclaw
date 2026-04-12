/**
 * 导入 agency-agents 到 RepaceClaw 脚本
 * 
 * agency-agents 已经通过 convert.sh --tool openclaw 转换为 OpenClaw 格式
 * 我们读取每个智能体的 SOUL.md + AGENTS.md + IDENTITY.md，然后：
 * 1. 提取 system prompt = SOUL + AGENTS
 * 2. 提取名称、emoji、描述
 * 3. 插入到 RepaceClaw SQLite 数据库的 agents 表中
 * 
 * 使用：node dist/scripts/import-agency-agents.js
 */

import fs from 'fs';
import path from 'path';
import { initDb, getDb, saveDb } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

// agency-agents 转换后的 OpenClaw 格式路径
const AGENCY_DIR = '/root/.openclaw/agency-agents';

interface AgencyAgent {
  id: string;
  name: string;
  description: string;
  emoji: string;
  systemPrompt: string;
  expertise: string[];
}

function readAgencyAgent(agentDir: string): AgencyAgent | null {
  try {
    const identityPath = path.join(agentDir, 'IDENTITY.md');
    const soulPath = path.join(agentDir, 'SOUL.md');
    const agentsPath = path.join(agentDir, 'AGENTS.md');

    if (!fs.existsSync(identityPath)) {
      console.warn(`Skipping ${agentDir}: no IDENTITY.md`);
      return null;
    }

    const identity = fs.readFileSync(identityPath, 'utf-8');
    const soul = fs.existsSync(soulPath) ? fs.readFileSync(soulPath, 'utf-8') : '';
    const agents = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf-8') : '';

    // 解析名称和 emoji
    // 格式通常是: # 🎨 Frontend Developer
    const firstLine = identity.split('\n')[0];
    const emojiMatch = firstLine.match(/^#\s*([^\s]+)\s*(.+)/);
    let name = path.basename(agentDir);
    let emoji = '🤖';
    if (emojiMatch) {
      emoji = emojiMatch[1];
      name = emojiMatch[2].trim();
    }

    // 提取描述：IDENTITY.md 第二行通常是描述
    const description = identity.split('\n').slice(1).find(line => line.trim()) || '';

    // 构建完整 system prompt
    let systemPrompt = '';
    if (soul) systemPrompt += soul + '\n\n';
    if (agents) systemPrompt += agents + '\n\n';
    systemPrompt = systemPrompt.trim();

    // 如果为空，使用 identity
    if (!systemPrompt) {
      systemPrompt = identity;
    }

    // 从描述提取 expertise 标签
    const expertise: string[] = [];
    // 从目录名称猜测领域
    const dirName = path.basename(agentDir);
    const parts = dirName.split('-');
    if (parts.length > 1) {
      // 比如 "frontend-developer" → ["frontend", "developer"]
      expertise.push(...parts.map(p => p.replace(/^./, c => c.toUpperCase())));
    } else {
      expertise.push(name.split(' ')[0]);
    }

    const id = uuidv4();
    return {
      id,
      name,
      description: description.trim(),
      emoji,
      systemPrompt,
      expertise: expertise.slice(0, 5),
    };
  } catch (err) {
    console.error(`Error reading ${agentDir}:`, err);
    return null;
  }
}

async function importAll() {
  console.log('=== Import agency-agents to RepaceClaw ===');
  
  await initDb();
  const db = getDb();

  if (!fs.existsSync(AGENCY_DIR)) {
    console.error(`agency-agents not found at ${AGENCY_DIR}`);
    console.error('Please run: ./scripts/convert.sh --tool openclaw in agency-agents repo first');
    process.exit(1);
  }

  const agentDirs = fs.readdirSync(AGENCY_DIR);
  console.log(`Found ${agentDirs.length} directories in ${AGENCY_DIR}`);

  let imported = 0;
  let skipped = 0;

  for (const dirName of agentDirs) {
    const fullDir = path.join(AGENCY_DIR, dirName);
    if (!fs.statSync(fullDir).isDirectory()) continue;

    // Check if it has the required files
    if (!fs.existsSync(path.join(fullDir, 'IDENTITY.md'))) {
      skipped++;
      continue;
    }

    const agent = readAgencyAgent(fullDir);
    if (!agent) {
      skipped++;
      continue;
    }

    // Check if already exists by name (simplified check)
    const existing = db.exec(
      'SELECT id FROM agents WHERE name = ?',
      [agent.name]
    );
    if (existing.length && existing[0].values.length > 0) {
      console.log(`Skipped "${agent.name}" — already exists`);
      skipped++;
      continue;
    }

    const now = new Date().toISOString();
    const color = getRandomColor();

    db.run(`
      INSERT INTO agents (
        id, name, color, system_prompt, writing_style, expertise, description,
        status, model_name, model_provider, temperature, max_tokens, top_p,
        frequency_penalty, presence_penalty, token_used, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      agent.id,
      agent.name,
      color,
      agent.systemPrompt,
      'balanced',
      JSON.stringify(agent.expertise),
      agent.description,
      'idle',
      '', // model_name — let user configure
      'openclaw', // model_provider — use OpenClaw
      0.7,
      4096,
      1,
      0,
      0,
      0,
      now,
    ]);

    imported++;
    console.log(`✅ Imported: ${agent.emoji} ${agent.name} (${agent.expertise.join(', ')})`);
  }

  saveDb();
  console.log('\n=== Import Complete ===');
  console.log(`Total imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Agency-agents is now integrated into RepaceClaw!`);
  console.log(`\nNext steps:`);
  console.log(`1. Go to RepaceClaw frontend → 智能体管理`);
  console.log(`2. You will see all ${imported} agency-agents imported`);
  console.log(`3. Each agent is configured to use OpenClaw as backend`);
  console.log(`4. Add an OpenClaw token channel in Token Settings`);
}

function getRandomColor(): string {
  const colors = [
    '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
    '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
    '#14B8A6', '#F97316', '#A855F7', '#EF4444', '#059669',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Run
importAll().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
