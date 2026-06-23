const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

const sites = [
  { name: 'TAG机场', url: 'https://tagss.pro' },
  { name: 'CoffeeCloud 咖啡云', url: 'https://aicoffee.app' },
  { name: '肥猫云 (FatCat Cloud)', url: 'https://inv03.fcweba.cc' },
  { name: 'Nexitally 奶昔机场', url: 'https://nxonearth.com' },
  { name: 'SNTP 守候网络', url: 'https://dash15.newsntp.net' },
  { name: 'BoostNet', url: 'https://999.boostnet1.com' },
  { name: 'NiceCloud 耐思云', url: 'https://nicecloud.co' },
  { name: 'Yue.to 悦通', url: 'https://my.yue.to' },
  { name: '星链机场', url: 'https://www.xn--mes995ajya725k.com' },
  { name: 'E-IX 机场', url: 'https://cdn.e-ix.org' },
  { name: '极速云', url: 'https://web.jisujichang.net' },
  { name: 'SSR Dog', url: 'https://dog.ssrdog.com' },
  { name: 'WgetCloud', url: 'https://b8cfff2a4jquxdbmwbaj.wgetcloud.org' },
  { name: 'FlyingBird', url: 'https://fbinv02.fbaff.cc' },
  { name: '青云梯', url: 'https://qytcc01a.qingyunti.pro' }
];

const DATA_DIR = path.join(__dirname, '..', 'status-data');
const DATA_FILE = path.join(DATA_DIR, 'status-data.json');
const MAX_LOGS = 2880; // 30 days at 15m intervals (4 * 24 * 30)

function ping(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = url.startsWith('https') ? https.get : http.get;
    
    const request = req(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      const time = Date.now() - start;
      // KEY CHANGE: Treat 403 (Cloudflare WAF) as UP since the server responded.
      const isUp = res.statusCode >= 200 && res.statusCode <= 403;
      resolve({ up: isUp, time, statusCode: res.statusCode });
    });
    
    request.on('error', (err) => {
      resolve({ up: false, time: Date.now() - start, error: err.message });
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      resolve({ up: false, time: 10000, error: 'Timeout' });
    });
  });
}

async function run() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let history = [];
  if (fs.existsSync(DATA_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.log('Failed to parse existing data', e);
    }
  }

  const results = [];
  const now = new Date().toISOString();

  for (const site of sites) {
    console.log(`Checking ${site.name}...`);
    const res = await ping(site.url);
    console.log(`[${site.name}] Status: ${res.statusCode || res.error}, Up: ${res.up}, Time: ${res.time}ms`);
    
    // Find existing
    let siteHistory = history.find(s => s.name === site.name);
    if (!siteHistory) {
      siteHistory = { name: site.name, url: site.url, logs: [] };
    }
    
    // Add new log
    siteHistory.logs.push({
      timestamp: now,
      up: res.up,
      time: res.time
    });
    
    // Keep only last 30 days
    if (siteHistory.logs.length > MAX_LOGS) {
      siteHistory.logs = siteHistory.logs.slice(-MAX_LOGS);
    }
    
    // Calculate uptime and avg time
    const upCount = siteHistory.logs.filter(l => l.up).length;
    const uptime = ((upCount / siteHistory.logs.length) * 100).toFixed(2);
    
    const upLogs = siteHistory.logs.filter(l => l.up);
    const avgTime = upLogs.length > 0 
      ? Math.round(upLogs.reduce((acc, curr) => acc + curr.time, 0) / upLogs.length) 
      : 0;

    results.push({
      name: site.name,
      url: site.url,
      status: res.up ? 'up' : 'down',
      time: res.time,
      avgTime: avgTime,
      uptime: uptime,
      logs: siteHistory.logs // Keep history for future passes
    });
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(results, null, 2));
  console.log('Finished monitoring.');
}

run();
