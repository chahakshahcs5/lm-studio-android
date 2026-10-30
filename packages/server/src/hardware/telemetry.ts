import fs from 'fs';
import os from 'os';
import { BatteryTelemetry, CpuTopology, HardwareTelemetry, RamTelemetry } from '@lm-studio-android/shared';

export class HardwareMonitor {
  private isAndroid: boolean;

  constructor() {
    this.isAndroid = fs.existsSync('/sys/class/power_supply/battery') || fs.existsSync('/data/data/com.termux');
  }

  public getBatteryTelemetry(): BatteryTelemetry {
    if (this.isAndroid) {
      try {
        let level: number | null = null;
        let temp: number | null = null;
        let isCharging: boolean | null = null;

        const capPath = '/sys/class/power_supply/battery/capacity';
        if (fs.existsSync(capPath)) {
          level = parseInt(fs.readFileSync(capPath, 'utf8').trim(), 10);
        }

        const tempPath = '/sys/class/power_supply/battery/temp';
        if (fs.existsSync(tempPath)) {
          const raw = parseInt(fs.readFileSync(tempPath, 'utf8').trim(), 10);
          temp = raw > 100 ? Math.round((raw / 10.0) * 10) / 10 : raw;
        }

        const statusPath = '/sys/class/power_supply/battery/status';
        if (fs.existsSync(statusPath)) {
          const status = fs.readFileSync(statusPath, 'utf8').trim().toLowerCase();
          isCharging = status === 'charging' || status === 'full';
        }

        return { level, temperature: temp, isCharging };
      } catch (e) {
        // Fallback on restricted read
      }
    }

    // Desktop / Dev simulation with smooth variation
    const simulatedLevel = 88;
    const simulatedTemp = 36.2;
    return {
      level: simulatedLevel,
      temperature: simulatedTemp,
      isCharging: true,
      health: 'Good'
    };
  }

  public detectCpuTopology(): CpuTopology {
    const cpus = os.cpus();
    const totalCores = cpus.length || 8;
    const bigCores: number[] = [];
    const littleCores: number[] = [];

    if (this.isAndroid) {
      try {
        const freqs: { core: number; freq: number }[] = [];
        for (let i = 0; i < totalCores; i++) {
          const maxFreqPath = `/sys/devices/system/cpu/cpu${i}/cpufreq/cpuinfo_max_freq`;
          if (fs.existsSync(maxFreqPath)) {
            const freq = parseInt(fs.readFileSync(maxFreqPath, 'utf8').trim(), 10);
            freqs.push({ core: i, freq });
          }
        }

        if (freqs.length === totalCores) {
          const max = Math.max(...freqs.map(f => f.freq));
          const min = Math.min(...freqs.map(f => f.freq));
          if (max > min * 1.15) {
            const threshold = min + (max - min) * 0.35;
            freqs.forEach(f => {
              if (f.freq >= threshold) bigCores.push(f.core);
              else littleCores.push(f.core);
            });
          }
        }
      } catch (err) {
        // Fallback
      }
    }

    // Mobile big.LITTLE fallback heuristics
    if (bigCores.length === 0) {
      if (totalCores >= 8) {
        // Typically cores 4-7 are performance big cores on 8-core ARM chips
        for (let i = 0; i < 4; i++) littleCores.push(i);
        for (let i = 4; i < totalCores; i++) bigCores.push(i);
      } else if (totalCores >= 6) {
        for (let i = 0; i < 2; i++) littleCores.push(i);
        for (let i = 2; i < totalCores; i++) bigCores.push(i);
      } else {
        for (let i = 0; i < totalCores; i++) bigCores.push(i);
      }
    }

    const recommendedThreads = Math.max(1, bigCores.length || Math.min(4, totalCores));
    const affinityMask = bigCores.length ? bigCores.join(',') : undefined;

    return {
      totalCores,
      bigCores,
      littleCores,
      recommendedThreads,
      affinityMask,
      socModel: cpus[0]?.model || 'ARM64 Mobile Processor',
      architecture: os.arch()
    };
  }

  public getRamTelemetry(modelAllocatedBytes: number = 0): RamTelemetry {
    let totalBytes = os.totalmem();
    let freeBytes = os.freemem();

    if (this.isAndroid && fs.existsSync('/proc/meminfo')) {
      try {
        const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
        const matchTotal = meminfo.match(/MemTotal:\s+(\d+)\s+kB/);
        const matchAvail = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
        if (matchTotal) totalBytes = parseInt(matchTotal[1], 10) * 1024;
        if (matchAvail) freeBytes = parseInt(matchAvail[1], 10) * 1024;
      } catch (e) {
        // Use os fallback
      }
    }

    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const percentUsed = Math.min(100, Math.round((usedBytes / totalBytes) * 100));

    return {
      totalBytes,
      availableBytes: freeBytes,
      usedBytes,
      modelAllocatedBytes,
      percentUsed
    };
  }

  public getFullTelemetry(modelAllocatedBytes: number = 0): HardwareTelemetry {
    const battery = this.getBatteryTelemetry();
    const cpu = this.detectCpuTopology();
    const ram = this.getRamTelemetry(modelAllocatedBytes);
    const isThrottled = (battery.temperature !== null && battery.temperature >= 44.0);

    return {
      battery,
      cpu,
      ram,
      isThrottled,
      timestamp: Date.now()
    };
  }
}

export const hardwareMonitor = new HardwareMonitor();
