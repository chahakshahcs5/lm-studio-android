import os from 'os';

export function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (
          name.toLowerCase().includes('wlan') ||
          name.toLowerCase().includes('wi-fi') ||
          name.toLowerCase().includes('wifi')
        ) {
          return iface.address;
        }
        candidates.push(iface.address);
      }
    }
  }

  const isPrivateIp = (ip: string) => {
    if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
    if (ip.startsWith('172.')) {
      const secondOctet = parseInt(ip.split('.')[1], 10);
      return secondOctet >= 16 && secondOctet <= 31;
    }
    return false;
  };

  const localPrivate = candidates.find(isPrivateIp);
  return localPrivate || candidates[0] || '127.0.0.1';
}

