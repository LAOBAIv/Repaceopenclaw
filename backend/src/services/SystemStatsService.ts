/**
 * SystemStatsService - 系统状态数据采集
 * 零依赖：仅使用 Node.js 原生 os + process 模块
 */
import os from 'os';
import fs from 'fs';

export interface SystemStats {
  hostname: string;
  platform: string;
  uptime: {
    system: number;    // 系统运行时间（秒）
    process: number;   // 进程运行时间（秒）
  };
  memory: {
    total: number;     // 总内存（字节）
    free: number;      // 可用内存（字节）
    used: number;      // 已用内存（字节）
    usagePercent: number; // 使用率（0-100）
    process: {
      rss: number;     // 进程 RSS 内存（字节）
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
  cpu: {
    model: string;
    cores: number;
    loadAvg: [number, number, number]; // 1/5/15 分钟
    usagePercent: number; // 当前 CPU 使用率估算
  };
  disk: {
    total: number;     // 总空间（字节）
    free: number;      // 可用空间（字节）
    used: number;      // 已用空间（字节）
    usagePercent: number; // 使用率（0-100）
  };
  network: {
    interfaces: Array<{
      name: string;
      address: string;
      family: string;
      internal: boolean;
    }>;
  };
  node: {
    version: string;
    env: string;
    pid: number;
    startTime: string; // ISO 时间
  };
}

export class SystemStatsService {
  /**
   * 获取系统状态
   */
  static getStats(): SystemStats {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // CPU 使用率估算（基于 loadAvg 和核心数）
    const loadAvg = os.loadavg();
    const cores = os.cpus().length;
    const cpuUsage = Math.min(100, (loadAvg[0] / cores) * 100);

    // 磁盘空间（Linux: 读取 / 分区）
    let diskInfo = { total: 0, free: 0, used: 0, usagePercent: 0 };
    try {
      const stat = fs.statfs ? null : null; // statfs 不可用，用 df 命令
      const dfOutput = require('child_process').execSync('df -B1 / 2>/dev/null | tail -1').toString().trim();
      const parts = dfOutput.split(/\s+/);
      if (parts.length >= 4) {
        const total = parseInt(parts[1]);
        const used = parseInt(parts[2]);
        const free = parseInt(parts[3]);
        diskInfo = {
          total,
          used,
          free,
          usagePercent: total > 0 ? (used / total) * 100 : 0,
        };
      }
    } catch {
      // 非 Linux 环境，跳过磁盘信息
    }

    // 网络接口（只取非 loopback）
    const netInterfaces: SystemStats['network']['interfaces'] = [];
    const nets = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(nets)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (!addr.internal) {
          netInterfaces.push({
            name,
            address: addr.address,
            family: addr.family,
            internal: addr.internal,
          });
        }
      }
    }

    const processStartTime = new Date(Date.now() - process.uptime() * 1000);

    return {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      uptime: {
        system: os.uptime(),
        process: process.uptime(),
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: (usedMem / totalMem) * 100,
        process: {
          rss: process.memoryUsage().rss,
          heapTotal: process.memoryUsage().heapTotal,
          heapUsed: process.memoryUsage().heapUsed,
          external: process.memoryUsage().external,
        },
      },
      cpu: {
        model: os.cpus()[0]?.model || 'Unknown',
        cores,
        loadAvg: loadAvg as [number, number, number],
        usagePercent: cpuUsage,
      },
      disk: diskInfo,
      network: {
        interfaces: netInterfaces,
      },
      node: {
        version: process.version,
        env: process.env.NODE_ENV || 'development',
        pid: process.pid,
        startTime: processStartTime.toISOString(),
      },
    };
  }

  /**
   * 获取人类可读的格式化统计
   */
  static getFormattedStats() {
    const stats = this.getStats();

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    const formatUptime = (seconds: number): string => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      if (days > 0) return `${days}d ${hours}h ${mins}m`;
      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins}m`;
    };

    return {
      hostname: stats.hostname,
      platform: stats.platform,
      uptime: {
        system: formatUptime(stats.uptime.system),
        process: formatUptime(stats.uptime.process),
      },
      memory: {
        total: formatBytes(stats.memory.total),
        used: formatBytes(stats.memory.used),
        free: formatBytes(stats.memory.free),
        usagePercent: `${stats.memory.usagePercent.toFixed(1)}%`,
        processRss: formatBytes(stats.memory.process.rss),
      },
      cpu: {
        model: stats.cpu.model.split(' @ ')[0]?.trim() || stats.cpu.model,
        cores: stats.cpu.cores,
        loadAvg: stats.cpu.loadAvg.map(l => l.toFixed(2)),
        usagePercent: `${stats.cpu.usagePercent.toFixed(1)}%`,
      },
      disk: stats.disk.total > 0 ? {
        total: formatBytes(stats.disk.total),
        used: formatBytes(stats.disk.used),
        free: formatBytes(stats.disk.free),
        usagePercent: `${stats.disk.usagePercent.toFixed(1)}%`,
      } : 'N/A',
      node: {
        version: stats.node.version,
        pid: stats.node.pid,
        uptime: formatUptime(stats.uptime.process),
      },
    };
  }
}
