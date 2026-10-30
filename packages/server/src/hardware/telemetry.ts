import fs from 'fs';
import os from 'os';
import { execFileSync } from 'child_process';
import {
  BatteryTelemetry,
  CpuTopology,
  HardwareTelemetry,
  RamTelemetry,
} from '@lm-studio-android/shared';

interface CpuStatSample {
  total: number;
  idle: number;
}

export class HardwareMonitor {
  private isAndroid: boolean;
  private prevTotalSample: CpuStatSample | null = null;
  private prevCoreSamples: Map<number, CpuStatSample> = new Map();
  private cachedSocModel: string | null = null;
  private cachedDeviceModel: string | null = null;
  private cachedBigCores: number[] | null = null;
  private cachedLittleCores: number[] | null = null;
  private cachedBatteryTelemetry: BatteryTelemetry | null = null;
  private cachedBatteryTimestamp: number = 0;

  constructor() {
    this.isAndroid =
      fs.existsSync('/data/data/com.termux') ||
      fs.existsSync('/system/bin/getprop') ||
      Boolean(process.env.ANDROID_ROOT) ||
      Boolean(process.env.TERMUX_VERSION) ||
      fs.existsSync('/sys/class/power_supply/battery');
  }

  public getIsAndroid(): boolean {
    return this.isAndroid;
  }

  private getProp(propName: string): string {
    try {
      if (this.isAndroid && fs.existsSync('/system/bin/getprop')) {
        const val = execFileSync('/system/bin/getprop', [propName], {
          encoding: 'utf8',
          timeout: 1000,
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        return val;
      }
    } catch {
      // ignore
    }
    return '';
  }

  public detectDeviceAndSoc(): { socModel: string; deviceModel: string } {
    if (this.cachedSocModel && this.cachedDeviceModel) {
      return { socModel: this.cachedSocModel, deviceModel: this.cachedDeviceModel };
    }

    let soc = '';
    let device = '';

    if (this.isAndroid) {
      const brand = this.getProp('ro.product.brand') || this.getProp('ro.product.manufacturer');
      const model = this.getProp('ro.product.model') || this.getProp('ro.product.device');
      const socName = this.getProp('ro.soc.model') || this.getProp('ro.board.platform') || this.getProp('ro.hardware');
      const chipname = this.getProp('ro.chipname');

      if (brand || model) {
        device = `${brand} ${model}`.trim();
      }

      if (socName || chipname) {
        soc = (socName || chipname).toUpperCase();
        if (soc.includes('SM') || soc.includes('QUALCOMM') || soc.includes('KALAMA') || soc.includes('TARO')) {
          soc = `Snapdragon (${soc})`;
        } else if (soc.includes('MT') || soc.includes('DIMENSITY')) {
          soc = `MediaTek Dimensity (${soc})`;
        } else if (soc.includes('EXYNOS')) {
          soc = `Samsung Exynos (${soc})`;
        } else if (soc.includes('TENSOR')) {
          soc = `Google Tensor (${soc})`;
        }
      }
    }

    if (!soc) {
      const cpus = os.cpus();
      soc = cpus[0]?.model || `${os.arch().toUpperCase()} Multi-Core Processor`;
    }

    if (!device) {
      device = os.hostname() || 'Android Device';
    }

    this.cachedSocModel = soc;
    this.cachedDeviceModel = device;
    return { socModel: soc, deviceModel: device };
  }

  public getBatteryTelemetry(): BatteryTelemetry {
    const now = Date.now();
    if (this.cachedBatteryTelemetry && now - this.cachedBatteryTimestamp < 5000) {
      return this.cachedBatteryTelemetry;
    }

    let level: number | null = null;
    let temp: number | null = null;
    let isCharging: boolean | null = null;
    let source: 'sysfs' | 'termux-api' | 'thermal_zone' | 'estimated' = 'estimated';
    let sensorLabel = 'Battery';

    // 1. Try termux-battery-status if in Termux
    if (this.isAndroid) {
      try {
        const out = execFileSync('termux-battery-status', [], {
          encoding: 'utf8',
          timeout: 1200,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        if (out) {
          const json = JSON.parse(out);
          if (typeof json.percentage === 'number') {
            level = json.percentage;
            temp = json.temperature !== undefined ? Math.round(json.temperature * 10) / 10 : null;
            isCharging = json.status === 'CHARGING' || json.plugged?.includes('PLUGGED');
            source = 'termux-api';
            return { level, temperature: temp, isCharging, source, sensorLabel: 'Termux Battery Sensor' };
          }
        }
      } catch {
        // termux-api not installed, fall through to sysfs / dumpsys
      }

      // 2. Try Android dumpsys battery service
      try {
        if (fs.existsSync('/system/bin/dumpsys')) {
          const dumpsys = execFileSync('/system/bin/dumpsys', ['battery'], {
            encoding: 'utf8',
            timeout: 1200,
            stdio: ['ignore', 'pipe', 'ignore'],
          });
          if (dumpsys) {
            const levelMatch = dumpsys.match(/level:\s*(\d+)/i);
            const tempMatch = dumpsys.match(/temperature:\s*(\d+)/i);
            const statusMatch = dumpsys.match(/status:\s*(\d+)/i);
            const acMatch = dumpsys.match(/AC powered:\s*true/i);
            const usbMatch = dumpsys.match(/USB powered:\s*true/i);

            if (levelMatch) {
              level = parseInt(levelMatch[1], 10);
              source = 'sysfs';
            }
            if (tempMatch && temp === null) {
              const rawT = parseInt(tempMatch[1], 10);
              temp = rawT > 100 ? Math.round((rawT / 10.0) * 10) / 10 : rawT;
              sensorLabel = 'Battery Sensor';
            }
            if (statusMatch) {
              isCharging = statusMatch[1] === '2'; // 2 = BATTERY_STATUS_CHARGING
            } else if (acMatch || usbMatch) {
              isCharging = true;
            }
          }
        }
      } catch {
        // dumpsys restricted
      }

      // 3. Try cmd battery get level
      if (level === null) {
        try {
          if (fs.existsSync('/system/bin/cmd')) {
            const cmdLvl = execFileSync('/system/bin/cmd', ['battery', 'get', 'level'], {
              encoding: 'utf8',
              timeout: 1000,
              stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            const parsed = parseInt(cmdLvl, 10);
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
              level = parsed;
              source = 'sysfs';
            }
          }
        } catch {
          // cmd restricted
        }
      }

      // 4. Try power_supply directories
      try {
        const psDirs = ['/sys/class/power_supply/battery', '/sys/class/power_supply/bms', '/sys/class/power_supply/BAT0'];
        for (const dir of psDirs) {
          if (fs.existsSync(dir)) {
            if (level === null) {
              const capPath = `${dir}/capacity`;
              if (fs.existsSync(capPath)) {
                level = parseInt(fs.readFileSync(capPath, 'utf8').trim(), 10);
              }
            }

            if (temp === null) {
              const tempPath = `${dir}/temp`;
              if (fs.existsSync(tempPath)) {
                const raw = parseInt(fs.readFileSync(tempPath, 'utf8').trim(), 10);
                temp = raw > 100 ? Math.round((raw / 10.0) * 10) / 10 : raw;
                sensorLabel = 'Battery Sensor';
              }
            }

            if (isCharging === null) {
              const statusPath = `${dir}/status`;
              if (fs.existsSync(statusPath)) {
                const status = fs.readFileSync(statusPath, 'utf8').trim().toLowerCase();
                isCharging = status === 'charging' || status === 'full';
              }
            }

            if (level !== null && temp !== null) {
              source = 'sysfs';
              break;
            }
          }
        }
      } catch {
        // sysfs restricted
      }

      // 5. Fallback for temperature: scan /sys/class/thermal/thermal_zone*
      if (temp === null) {
        try {
          const thermalDir = '/sys/class/thermal';
          if (fs.existsSync(thermalDir)) {
            const entries = fs.readdirSync(thermalDir).filter((e) => e.startsWith('thermal_zone'));
            for (const tz of entries) {
              const typePath = `${thermalDir}/${tz}/type`;
              const tempPath = `${thermalDir}/${tz}/temp`;
              if (fs.existsSync(typePath) && fs.existsSync(tempPath)) {
                const tzType = fs.readFileSync(typePath, 'utf8').trim().toLowerCase();
                if (
                  tzType.includes('battery') ||
                  tzType.includes('bms') ||
                  tzType.includes('tsens') ||
                  tzType.includes('soc') ||
                  tzType.includes('cpu')
                ) {
                  const raw = parseInt(fs.readFileSync(tempPath, 'utf8').trim(), 10);
                  if (raw > 0) {
                    temp = raw > 1000 ? Math.round((raw / 1000.0) * 10) / 10 : Math.round(raw * 10) / 10;
                    source = 'thermal_zone';
                    sensorLabel = tzType.includes('battery') || tzType.includes('bms') ? 'Battery Sensor' : 'SoC Thermal';
                    break;
                  }
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }

    // 6. Smooth Realistic Estimation if temperature is restricted
    if (temp === null) {
      const cpuUsage = this.getQuickCpuUsage();
      const baseTemp = 36.0 + (cpuUsage / 100) * 9.0;
      temp = Math.round(baseTemp * 10) / 10;
      sensorLabel = 'Estimated Thermal';
    }

    const result: BatteryTelemetry = {
      level, // Genuine level or null (never fabricate fake numbers like 82%)
      temperature: temp,
      isCharging: isCharging ?? false,
      source: level !== null ? source : 'estimated',
      sensorLabel,
    };

    this.cachedBatteryTelemetry = result;
    this.cachedBatteryTimestamp = now;
    return result;
  }

  private getQuickCpuUsage(): number {
    try {
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += (cpu.times as any)[type];
        }
        totalIdle += cpu.times.idle;
      }
      return totalTick > 0 ? Math.round((1 - totalIdle / totalTick) * 100) : 15;
    } catch {
      return 15;
    }
  }

  public detectCpuTopology(): CpuTopology {
    const cpus = os.cpus();
    const totalCores = cpus.length || 8;
    const bigCores: number[] = [];
    const littleCores: number[] = [];

    if (this.cachedBigCores && this.cachedLittleCores) {
      bigCores.push(...this.cachedBigCores);
      littleCores.push(...this.cachedLittleCores);
    } else {
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
            const max = Math.max(...freqs.map((f) => f.freq));
            const min = Math.min(...freqs.map((f) => f.freq));
            if (max > min * 1.15) {
              const threshold = min + (max - min) * 0.35;
              freqs.forEach((f) => {
                if (f.freq >= threshold) bigCores.push(f.core);
                else littleCores.push(f.core);
              });
            }
          }
        } catch {
          // fallback
        }
      }

      // Fallback heuristics for standard 8-core and 6-core ARM architectures
      if (bigCores.length === 0) {
        if (totalCores >= 8) {
          for (let i = 0; i < 4; i++) littleCores.push(i);
          for (let i = 4; i < totalCores; i++) bigCores.push(i);
        } else if (totalCores >= 6) {
          for (let i = 0; i < 2; i++) littleCores.push(i);
          for (let i = 2; i < totalCores; i++) bigCores.push(i);
        } else {
          for (let i = 0; i < totalCores; i++) bigCores.push(i);
        }
      }

      this.cachedBigCores = [...bigCores];
      this.cachedLittleCores = [...littleCores];
    }

    const { socModel, deviceModel } = this.detectDeviceAndSoc();
    const recommendedThreads = Math.max(1, bigCores.length || Math.min(4, totalCores));
    const affinityMask = bigCores.length ? bigCores.join(',') : undefined;

    // Measure live CPU utilization
    const { overallCpuUsage, coreUsages } = this.getLiveCpuUsages(totalCores);

    return {
      totalCores,
      bigCores,
      littleCores,
      recommendedThreads,
      affinityMask,
      socModel,
      deviceModel,
      architecture: os.arch(),
      overallCpuUsage,
      coreUsages,
    };
  }

  private getLiveCpuUsages(totalCores: number): {
    overallCpuUsage: number;
    coreUsages: number[];
  } {
    // 1. Try reading /proc/stat on Linux / Android
    if (this.isAndroid && fs.existsSync('/proc/stat')) {
      try {
        const content = fs.readFileSync('/proc/stat', 'utf8');
        const lines = content.split('\n');

        let overallCpuUsage = 0;
        const coreUsages: number[] = [];

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts[0] === 'cpu') {
            const user = parseInt(parts[1], 10) || 0;
            const nice = parseInt(parts[2], 10) || 0;
            const system = parseInt(parts[3], 10) || 0;
            const idle = parseInt(parts[4], 10) || 0;
            const iowait = parseInt(parts[5], 10) || 0;
            const irq = parseInt(parts[6], 10) || 0;
            const softirq = parseInt(parts[7], 10) || 0;
            const steal = parseInt(parts[8], 10) || 0;

            const total = user + nice + system + idle + iowait + irq + softirq + steal;
            const currentIdle = idle + iowait;

            if (this.prevTotalSample) {
              const deltaTotal = total - this.prevTotalSample.total;
              const deltaIdle = currentIdle - this.prevTotalSample.idle;
              if (deltaTotal > 0) {
                overallCpuUsage = Math.max(0, Math.min(100, Math.round(((deltaTotal - deltaIdle) / deltaTotal) * 100)));
              }
            }
            this.prevTotalSample = { total, idle: currentIdle };
          } else if (parts[0].startsWith('cpu') && /cpu\d+/.test(parts[0])) {
            const coreIdx = parseInt(parts[0].replace('cpu', ''), 10);
            const user = parseInt(parts[1], 10) || 0;
            const nice = parseInt(parts[2], 10) || 0;
            const system = parseInt(parts[3], 10) || 0;
            const idle = parseInt(parts[4], 10) || 0;
            const iowait = parseInt(parts[5], 10) || 0;
            const irq = parseInt(parts[6], 10) || 0;
            const softirq = parseInt(parts[7], 10) || 0;
            const steal = parseInt(parts[8], 10) || 0;

            const total = user + nice + system + idle + iowait + irq + softirq + steal;
            const currentIdle = idle + iowait;

            let coreUsage = 0;
            const prev = this.prevCoreSamples.get(coreIdx);
            if (prev) {
              const deltaTotal = total - prev.total;
              const deltaIdle = currentIdle - prev.idle;
              if (deltaTotal > 0) {
                coreUsage = Math.max(0, Math.min(100, Math.round(((deltaTotal - deltaIdle) / deltaTotal) * 100)));
              }
            }
            this.prevCoreSamples.set(coreIdx, { total, idle: currentIdle });
            coreUsages[coreIdx] = coreUsage;
          }
        }

        if (coreUsages.length > 0) {
          return { overallCpuUsage, coreUsages };
        }
      } catch {
        // fallback
      }
    }

    // 2. OS fallback via os.cpus()
    try {
      const cpus = os.cpus();
      const coreUsages = cpus.map((c) => {
        let total = 0;
        for (const type in c.times) {
          total += (c.times as any)[type];
        }
        const usage = total > 0 ? Math.round((1 - c.times.idle / total) * 100) : 0;
        return Math.max(0, Math.min(100, usage));
      });
      const overallCpuUsage = Math.round(coreUsages.reduce((a, b) => a + b, 0) / (coreUsages.length || 1));
      return { overallCpuUsage, coreUsages };
    } catch {
      return { overallCpuUsage: 0, coreUsages: new Array(totalCores).fill(0) };
    }
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
      } catch {
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
      percentUsed,
    };
  }

  public getFullTelemetry(modelAllocatedBytes: number = 0): HardwareTelemetry {
    const battery = this.getBatteryTelemetry();
    const cpu = this.detectCpuTopology();
    const ram = this.getRamTelemetry(modelAllocatedBytes);
    const isBatterySensor =
      battery.sensorLabel?.toLowerCase().includes('battery') ||
      battery.sensorLabel?.toLowerCase().includes('bms');
    // Mobile SoC silicon junction (TSENS) operating range is 45°C - 75°C under LLM load; throttles at ~80°C+.
    // Physical battery threshold is 45°C.
    const throttleThreshold = isBatterySensor ? 45.0 : 78.0;
    const isThrottled = battery.temperature !== null && battery.temperature >= throttleThreshold;

    return {
      battery,
      cpu,
      ram,
      isThrottled,
      timestamp: Date.now(),
    };
  }
}

export const hardwareMonitor = new HardwareMonitor();
