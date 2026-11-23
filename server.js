const http = require('http');

const PORT = process.env.PORT || 3000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CHECK_TIMEOUT_MS = 10000;
const HISTORY_LEN = 12;

const SERVICES = [
  {
    id: 'status-board',
    name: 'Altare · 状态看板（本站）',
    url: 'https://status-ivy.go.altare.global',
    checkUrl: 'http://127.0.0.1:' + PORT + '/', // self check: the app itself
    note: '本看板自己，全天在线不休眠',
  },
  {
    id: 'hello-ivy',
    name: 'Altare · hello-ivy（测试应用）',
    url: 'https://hello-ivy.go.altare.global',
    note: '第一个测试应用，Express 模板',
  },
  {
    id: 'cloady',
    name: 'Cloady · hello-world',
    url: 'https://hello-world-h6bl46ca-workspace-949.cloady.io/',
    note: '免费试用，12月3日到期前要决定留不留',
  },
  {
    id: 'cloudzyro',
    name: 'Cloudzyro · ivy-dashboard',
    url: 'https://ivy-dashboard.cloudzyro.app/',
    note: '没人访问 1 小时后会休眠，首次打开要等几秒唤醒',
  },
  {
    id: 'uppcoder',
    name: 'Uppcoder · AI 导航',
    url: 'https://ivp5upvu-express-ai.apps-5.websson.cloud/',
    note: '已暂停，11月27日删除（你决定的）',
  },
  {
    id: 'simular',
    name: 'Simular Box · main',
    url: 'https://box.simular.ai/box/cb-a213e938a929',
    note: '盒子闲置会休眠，页面本身一直能打开',
  },
  {
    id: 'kaggle',
    name: 'Kaggle',
    url: 'https://www.kaggle.com/ivyyoung0123',
    note: '公开主页',
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/ivyyoung0123',
    note: '公开主页',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    url: 'https://openrouter.ai',
    note: '免费模型入口',
  },
  {
    id: 'perchai',
    name: 'Perchai',
    url: 'https://chat.perchai.app/',
    note: '聊天入口',
  },
  {
    id: 'liberclaw',
    name: 'LiberClaw',
    url: 'https://app.liberclaw.ai/',
    note: '平台能打开；小弟 agent 还没起来（等你重新登录再试）',
  },
  {
    id: 'numes',
    name: 'Numes API',
    url: 'https://api.numes.ai/api/v1/models',
    note: '返回 401 也算在线（接口需要密钥才能调）',
    anyResponse: true,
  },
];

// state: id -> { status, code, ms, at, history: ['up'|'down'] }
const state = {};
for (const s of SERVICES) {
  state[s.id] = { status: 'checking', code: null, ms: null, at: null, history: [] };
}

async function checkService(s) {
  const target = s.checkUrl || s.url;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IvyStatusBoard/1.0)' },
    });
    const ms = Date.now() - started;
    const up = s.anyResponse ? true : res.status < 400;
    return { status: up ? 'up' : 'down', code: res.status, ms, at: new Date().toISOString() };
  } catch (e) {
    return { status: 'down', code: 0, ms: Date.now() - started, at: new Date().toISOString() };
  } finally {
    clearTimeout(timer);
  }
}

async function runChecks() {
  const results = await Promise.all(SERVICES.map(checkService));
  results.forEach((r, i) => {
    const s = SERVICES[i];
    const cur = state[s.id];
    cur.status = r.status;
    cur.code = r.code;
    cur.ms = r.ms;
    cur.at = r.at;
    cur.history.push(r.status);
    if (cur.history.length > HISTORY_LEN) cur.history.shift();
  });
  console.log(new Date().toISOString(), 'check round done');
}

const PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ivy 的服务状态</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f3f4f6; color: #111827; }
  header { background: #111827; color: #f9fafb; padding: 20px 24px; }
  header h1 { margin: 0; font-size: 22px; }
  header p { margin: 6px 0 0; color: #9ca3af; font-size: 14px; }
  .bar { display: flex; align-items: center; gap: 12px; padding: 14px 24px; font-size: 14px; color: #4b5563; flex-wrap: wrap; }
  .bar button { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 6px 14px; font-size: 14px; cursor: pointer; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; padding: 0 24px 24px; }
  .card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .card h2 { margin: 0 0 8px; font-size: 16px; }
  .pill { display: inline-block; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 2px 10px; margin-left: 8px; vertical-align: middle; }
  .pill.up { background: #dcfce7; color: #166534; }
  .pill.down { background: #fee2e2; color: #991b1b; }
  .pill.checking { background: #e5e7eb; color: #4b5563; }
  .url { font-size: 13px; color: #2563eb; word-break: break-all; text-decoration: none; }
  .meta { font-size: 13px; color: #6b7280; margin: 8px 0 0; }
  .note { font-size: 13px; color: #6b7280; margin: 6px 0 0; }
  .dots { margin-top: 10px; display: flex; gap: 4px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #d1d5db; }
  .dot.up { background: #22c55e; }
  .dot.down { background: #ef4444; }
  .dots span { font-size: 12px; color: #9ca3af; margin-left: 6px; }
  footer { padding: 0 24px 24px; font-size: 13px; color: #9ca3af; }
</style>
</head>
<body>
<header>
  <h1>Ivy 的服务状态</h1>
  <p>免费服务一览 · 服务端每 5 分钟检查一次 · 页面每 30 秒刷新</p>
</header>
<div class="bar">
  <span id="updated">正在检查…</span>
  <span id="summary"></span>
  <button id="refresh" type="button">立即刷新</button>
</div>
<div class="grid" id="grid"></div>
<footer>跑在 Altare 免费版上 · 在线 = 服务有响应（Numes 返回 401 也算在线，因为接口本来就要密钥）</footer>
<script>
  function fmtTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleString('zh-CN', { hour12: false });
  }
  function render(data) {
    document.getElementById('updated').textContent = '上次检查：' + fmtTime(data.updatedAt);
    var up = 0, down = 0, checking = 0;
    data.services.forEach(function (s) {
      if (s.status === 'up') up++;
      else if (s.status === 'down') down++;
      else checking++;
    });
    document.getElementById('summary').textContent = '在线 ' + up + ' · 离线 ' + down + (checking ? ' · 检查中 ' + checking : '');
    var grid = document.getElementById('grid');
    grid.innerHTML = '';
    data.services.forEach(function (s) {
      var card = document.createElement('div');
      card.className = 'card';
      var pill = s.status === 'up' ? '在线' : s.status === 'down' ? '离线' : '检查中';
      var meta = s.status === 'checking'
        ? '首次检查中…'
        : 'HTTP ' + (s.code || '—') + ' · ' + (s.ms == null ? '—' : s.ms + 'ms') + ' · ' + fmtTime(s.at);
      var dots = (s.history || []).map(function (h) {
        return '<span class="dot ' + h + '"></span>';
      }).join('');
      card.innerHTML =
        '<h2>' + s.name + '<span class="pill ' + s.status + '">' + pill + '</span></h2>' +
        '<a class="url" href="' + s.url + '" target="_blank" rel="noopener">' + s.url + '</a>' +
        '<p class="meta">' + meta + '</p>' +
        (s.note ? '<p class="note">' + s.note + '</p>' : '') +
        '<div class="dots">' + dots + '<span>最近 ' + (s.history || []).length + ' 次</span></div>';
      grid.appendChild(card);
    });
  }
  function load() {
    fetch('/api/status').then(function (r) { return r.json(); }).then(render).catch(function () {
      document.getElementById('updated').textContent = '拉取状态失败，稍后再试';
    });
  }
  document.getElementById('refresh').addEventListener('click', load);
  load();
  setInterval(load, 30000);
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/status') {
    const payload = {
      updatedAt: new Date().toISOString(),
      intervalMinutes: CHECK_INTERVAL_MS / 60000,
      services: SERVICES.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        note: s.note,
        ...state[s.id],
      })),
    };
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
    return;
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(PORT, () => {
  console.log('status board listening on port ' + PORT);
  setTimeout(runChecks, 1000);
  setInterval(runChecks, CHECK_INTERVAL_MS);
});
