// index.js
const mineflayer = require("mineflayer");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 7860;
const activeBots = new Map();

app.use(express.json());

// 永久写死的服务器列表
const FIXED_BOTS = [
  { host: "syd.retslav.net",     port: 10257, username: "retslav001" },
  { host: "151.242.106.72",      port:25340, username: "vibegames001" },
  { host: "191.96.231.5",        port:30066, username: "mcserverhost001" },
  { host: "135.125.9.13",        port:2838,  username: "elementiamc001" },
];

// 创建 Bot（静默版，所有 console.log 改成可选）
function createBot(id, host, port, username) {
  try {
    const bot = mineflayer.createBot({
      host, port, username,
      version: false,
      hideErrors: true,
      checkTimeoutInterval: 60000,
    });

    bot.customId = id;
    bot.serverInfo = { host, port, username };
    bot.status = "connecting";
    bot.lastError = null;

    bot.once("spawn", () => {
      bot.status = "online";
      bot.lastError = null;
    });

    bot.on("end", () => { bot.status = "disconnected"; });
    bot.on("error", () => {});
    bot.on("kicked", () => { bot.status = "kicked"; });

    if (bot._client) {
      bot._client.removeAllListeners("error");
      bot._client.on("error", () => {});
    }

    activeBots.set(id, bot);
  } catch (e) {}
}

// 静默启动固定机器人
function startFixed() {
  FIXED_BOTS.forEach((cfg, i) => {
    setTimeout(() => createBot(`f${i}_${Date.now()}`, cfg.host, cfg.port, cfg.username), i * 3000);
  });
}

// API
app.get("/api/bots", (req, res) => {
  const list = [];
  activeBots.forEach((bot, id) => {
    list.push({
      id,
      host: bot.serverInfo.host,
      port: bot.serverInfo.port,
      username: bot.serverInfo.username,
      status: bot.status || "disconnected",
      error: bot.lastError,
      health: bot.health || 0,
      food: bot.food || 0,
    });
  });
  res.json(list);
});

app.post("/api/bots", (req, res) => {
  const { host, port = 25565, username } = req.body;
  if (!host || !username) return res.status(400).json({error:1});
  const id = `m_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  createBot(id, host, port, username);
  res.json({success:true,id});
});

app.delete("/api/bots/:id", (req, res) => {
  const bot = activeBots.get(req.params.id);
  if (bot) { try { bot.end(); } catch{} activeBots.delete(req.params.id); }
  res.json({success:true});
});

app.post("/api/bots/:id/reconnect", (req, res) => {
  const bot = activeBots.get(req.params.id);
  if (!bot) return res.status(404).json({error:1});
  const {host,port,username} = bot.serverInfo;
  try { bot.end(); } catch{}
  activeBots.delete(req.params.id);
  setTimeout(() => createBot(req.params.id, host, port, username), 1500);
  res.json({success:true});
});

// HTML（压缩在一行，避免混淆器报错）
app.get("/", (req, res) => res.type("html").send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MC Panel</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Segoe UI,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;min-height:100vh;padding:20px}.c{max-width:1200px;margin:0 auto}h1{text-align:center;margin:30px 0}.a{background:#fff;color:#333;padding:25px;border-radius:12px;margin-bottom:30px}input,button{padding:12px;margin:8px 0;border-radius:6px;width:100%;border:none;font-size:16px}input{border:2px solid #ddd}button{background:#667eea;color:#fff;cursor:pointer}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px}.d{background:#fff;color:#333;border-radius:12px;padding:20px}.s{padding:6px 12px;border-radius:20px;font-weight:bold;font-size:.9em}.online{background:#4caf50;color:#fff}.connecting{background:#ff9800;color:#fff}.error,.kicked{background:#f44336;color:#fff}.disconnected{background:#999;color:#fff}.a button:hover{background:#5568d3}</style></head><body><div class="c"><h1>MC Fake Player Panel</h1><div class="a"><input type="text" id="h" placeholder="Host"><input type="number" id="p" placeholder="Port" value="25565"><input type="text" id="u" placeholder="Username"><button onclick="add()">Add Bot</button></div><div id="l" class="g"></div></div><script>async function load(){try{const r=await fetch("/api/bots");const d=await r.json();const c=document.getElementById("l");c.innerHTML=d.length? d.map(b=>`<div class="d"><div style="display:flex;justify-content:space-between"><strong>\${b.username}</strong><span class="s \${b.status}">\${b.status.toUpperCase()}</span></div><div style="margin:10px 0;color:#555">\${b.host}:\${b.port}<br>${b.status==='online'?`HP: \${b.health}/20 | Food: \${b.food}/20`:''}</div>${b.error?`<div style="margin-top:10px;padding:10px;background:#ffebee;border-radius:6px;color:#c62828">Error: \${b.error}</div>`:''}<div style="margin-top:15px;display:flex;gap:10px"><button style="background:#4caf50;flex:1" onclick="r('\${b.id}')">重连</button><button style="background:#f44336;flex:1" onclick="d('\${b.id}')">删除</button></div></div>`).join("") : "<div style='text-align:center;color:#fff;font-size:1.5em;margin-top:80px'>暂无机器人</div>"}catch{}}function add(){const h=document.getElementById("h").value.trim(),p=document.getElementById("p").value||25565,u=document.getElementById("u").value.trim();if(!h||!u)return;fetch("/api/bots",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({host:h,port:+p,username:u})}).then(load)}function d(id){if(confirm("删除?"))fetch("/api/bots/"+id,{method:"DELETE"}).then(load)}function r(id){fetch("/api/bots/"+id+"/reconnect",{method:"POST"}).then(()=>setTimeout(load,1500))}setInterval(load,4000);load();</script></body></html>`));

// 10分钟静默自动重连
const reconnect = () => {
  const bots = Array.from(activeBots.entries());
  bots.forEach(([id, bot], i) => {
    setTimeout(() => {
      const {host,port,username} = bot.serverInfo;
      try { bot.end(); } catch{}
      activeBots.delete(id);
      setTimeout(() => createBot(id, host, port, username), 1200);
    }, i * 5000);
  });
};
setInterval(reconnect, 10*60*1000);

// 完全静默启动（一条 log 都不输出）
app.listen(PORT, "0.0.0.0", () => {
  startFixed();
});

// 屏蔽所有未捕获错误日志
process.removeAllListeners("uncaughtException");
process.removeAllListeners("unhandledRejection");
process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});
