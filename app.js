const http = require('http');
const { Pool } = require('pg');

const hostname = '0.0.0.0';
const port = 3000;

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'ryuu',
  password: process.env.DB_PASSWORD || 'rahasia123',
  database: process.env.DB_NAME || 'db_latihan',
  port: 5432,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000
});

pool.query('SELECT 1')
  .then(() => console.log('PostgreSQL Pool siap dan hangat!'))
  .catch(err => console.error('Gagal warm-up DB:', err.message));

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/db-check') {
    try {
      const dbRes = await pool.query('SELECT NOW()');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        message: 'Koneksi ke PostgreSQL Berhasil!',
        server_time: dbRes.rows[0].now
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
    return;
  }

  if (req.url === '/api/login' && req.method === 'POST') {
    try {
      const { username, password } = await getRequestBody(req);
      if (!username || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Username dan password wajib diisi!' }));
      }

      const userCheck = await pool.query(
        'SELECT id, username, password, high_score, max_stage FROM users WHERE username = $1',
        [username.trim()]
      );

      if (userCheck.rows.length === 0) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: '❌ User tidak dikenal!' }));
      }

      const user = userCheck.rows[0];

      if (user.password !== password) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: '⚠️ Password salah!' }));
      }

      delete user.password;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Database error: ' + err.message }));
    }
    return;
  }

  if (req.url === '/api/save-progress' && req.method === 'POST') {
    try {
      const { userId, highScore, maxStage } = await getRequestBody(req);
      if (userId) {
        await pool.query(
          'UPDATE users SET high_score = GREATEST(high_score, $1), max_stage = GREATEST(max_stage, $2) WHERE id = $3',
          [highScore || 0, Math.min(10, maxStage || 1), userId]
        );
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    if (req.url === '/api/register' && req.method === 'POST') {
  try {
    const { username, password } = await getRequestBody(req);
    const cleanUser = (username || '').trim();
    if (!cleanUser || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Username dan password wajib diisi!' }));
    }

    const exist = await pool.query('SELECT id FROM users WHERE username = $1', [cleanUser]);
    if (exist.rows.length > 0) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: '⚠️ Username sudah dipakai!' }));
    }

    const inserted = await pool.query(
      'INSERT INTO users (username, password, high_score, max_stage) VALUES ($1, $2, 0, 1) RETURNING id, username, high_score, max_stage',
      [cleanUser, password]
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, user: inserted.rows[0] }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Database error: ' + err.message }));
  }
  return;
}
    return;
  }

  let dbConnected = false;
  try {
    await pool.query('SELECT NOW()');
    dbConnected = true;
  } catch (err) {
    dbConnected = false;
  }

  const html = `
  <!DOCTYPE html>
  <html lang="id">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Retro Snake Game - PUBG BGM & Stealth Bombs</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      @keyframes shake {
        0%, 100% { transform: translate(0, 0); }
        20% { transform: translate(-8px, 6px); }
        40% { transform: translate(8px, -6px); }
        60% { transform: translate(-6px, -4px); }
        80% { transform: translate(6px, 4px); }
      }
      .animate-shake { animation: shake 0.4s ease-in-out; }
    </style>
  </head>
  <body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col items-center justify-center p-2 md:p-4 font-sans select-none">
    
    <!-- HALAMAN LOGIN -->
    <div id="loginScreen" class="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5">
      <div class="text-center space-y-1">
        <div class="text-4xl mb-2">🐍</div>
        <h1 class="font-extrabold text-2xl text-emerald-400 tracking-wide">SNAKE LOGIN</h1>
        <p class="text-xs text-slate-400">Masuk dengan akun database PostgreSQL</p>
      </div>

      <div class="flex justify-center">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${dbConnected ? 'bg-emerald-950 text-emerald-400 border-emerald-700' : 'bg-red-950 text-red-400 border-red-700'}">
          <span class="h-2 w-2 rounded-full ${dbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}"></span>
          ${dbConnected ? 'PostgreSQL Ready' : 'DB Disconnected'}
        </div>
      </div>

      <form onsubmit="handleLogin(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Username</label>
          <input type="text" id="loginUsername" required autocomplete="username" placeholder="Masukkan username..."
            class="w-full bg-slate-950 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500">
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Password</label>
          <input type="password" id="loginPassword" required autocomplete="current-password" placeholder="Masukkan password..."
            class="w-full bg-slate-950 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500">
        </div>

        <p id="loginError" class="hidden text-xs text-red-400 bg-red-950/60 border border-red-800/60 rounded-lg px-3 py-2 text-center"></p>

        <button type="submit" id="loginBtn"
          class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition text-sm shadow-lg shadow-emerald-600/30 active:scale-95">
          MASUK KE GAME
        </button>
      </form>
    </div>

    <!-- HALAMAN UTAMA GAME -->
    <div id="gameContainer" class="hidden w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-2xl space-y-3 relative">
      
      <!-- Top Bar -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🐍</span>
          <div>
            <h1 class="font-extrabold text-lg md:text-xl text-emerald-400 leading-tight flex items-center gap-2">
              SNAKE ARENA 
              <span class="text-[11px] bg-red-950 text-red-300 border border-red-700 px-2 py-0.5 rounded-md">💣 STEALTH MINES</span>
            </h1>
            <p class="text-xs text-slate-400">Player: <span id="playerNameDisplay" class="text-emerald-300 font-semibold">-</span></p>
          </div>
        </div>

        <!-- Panel Status -->
        <div class="flex items-center gap-3 md:gap-4 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 font-mono">
          <div>
            <span class="text-slate-500 text-[10px] block">STAGE</span>
            <span id="stageDisplay" class="text-sm md:text-base font-bold text-emerald-400">1 / 10</span>
          </div>
          <div class="border-l border-slate-800 pl-3 md:pl-4">
            <span class="text-slate-500 text-[10px] block">TARGET</span>
            <span id="targetDisplay" class="text-sm md:text-base font-bold text-amber-400">0 / 10</span>
          </div>
          <div class="border-l border-slate-800 pl-3 md:pl-4">
            <span class="text-slate-500 text-[10px] block">BOM</span>
            <span id="bombCountDisplay" class="text-sm md:text-base font-bold text-red-400">3 💣</span>
          </div>
          <div class="border-l border-slate-800 pl-3 md:pl-4">
            <span class="text-slate-500 text-[10px] block">SCORE</span>
            <span id="score" class="text-sm md:text-base font-bold text-yellow-400">0</span>
          </div>
          <div class="border-l border-slate-800 pl-3 md:pl-4">
            <span class="text-slate-500 text-[10px] block">HIGH SCORE</span>
            <span id="highScore" class="text-sm md:text-base font-bold text-indigo-400">0</span>
          </div>
        </div>

        <!-- Tombol Audio PUBG BGM & Logout -->
        <div class="flex items-center gap-2">
          <button onclick="toggleBgm()" id="bgmBtn" class="bg-amber-950/80 hover:bg-amber-900 text-amber-300 px-3 py-1.5 rounded-lg text-xs border border-amber-600 font-semibold transition">
            🪂 PUBG BGM: ON
          </button>
          <button onclick="toggleSound()" id="soundBtn" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs border border-slate-700 transition">
            🔊 SFX: ON
          </button>
          <button onclick="logout()" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800 transition">
            Logout
          </button>
        </div>
      </div>

      <!-- Canvas Game Luas (960 x 560 px) -->
      <div id="canvasWrapper" class="relative flex justify-center items-center w-full">
        <canvas id="gameCanvas" width="960" height="560" class="w-full max-w-[960px] h-auto bg-slate-950 rounded-xl border-2 border-dashed border-emerald-500/40 shadow-inner touch-none"></canvas>
        
        <!-- MENU PILIH STAGE 1 - 10 -->
        <div id="startMenuScreen" class="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-6 space-y-5 z-20">
          <div class="text-center max-w-lg">
            <h2 class="text-3xl md:text-4xl font-extrabold text-emerald-400 tracking-wider">SNAKE PUBG EDITION</h2>
            <p class="text-xs md:text-sm text-slate-400 mt-1.5">Waspada! Ada ranjau bom tak terlihat di lantai arena. Dengarkan bunyi radar dan perhatikan kedipan merah saat melintas di dekatnya!</p>
          </div>

          <div class="w-full max-w-sm space-y-1.5 text-center">
            <label class="text-xs text-slate-300 font-medium">Pilih Stage (1 - 10):</label>
            <select id="stageSelect" class="w-full bg-slate-900 text-slate-200 text-sm rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500 text-center font-bold">
            </select>
          </div>

          <button onclick="startGameFromMenu()" class="w-full max-w-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition text-base shadow-lg shadow-emerald-600/30 transform active:scale-95">
            🎮 MULAI BERMAIN
          </button>
        </div>

        <!-- Banner Level Up -->
        <div id="levelUpBanner" class="hidden absolute top-6 bg-emerald-500 text-slate-950 font-extrabold px-5 py-2 rounded-full shadow-lg text-sm md:text-base animate-bounce z-10">
          🎉 STAGE CLEARED! LANJUT STAGE BERIKUTNYA!
        </div>

        <!-- Banner Tamat Stage 10 -->
        <div id="victoryModal" class="hidden absolute inset-0 bg-slate-950/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center space-y-4 z-20 p-6 text-center">
          <div class="text-5xl">🏆</div>
          <h2 class="text-3xl font-extrabold text-amber-400">WINNER WINNER CHICKEN DINNER!</h2>
          <p class="text-slate-300 text-sm">Semua 10 Stage Tamat! Skor Akhir: <span id="victoryScore" class="font-bold text-yellow-400 text-lg">0</span></p>
          <button onclick="showStartMenu()" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-sm shadow-lg">
            Kembali ke Menu Stage
          </button>
        </div>

        <!-- Modal Game Over -->
        <div id="gameOverModal" class="hidden absolute inset-0 bg-slate-950/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center space-y-4 z-20 p-6">
          <h2 id="gameOverTitle" class="text-3xl font-extrabold text-red-500">💥 GAME OVER!</h2>
          <div class="text-center space-y-1">
            <p class="text-slate-300 text-base">Skor Akhir: <span id="finalScore" class="font-bold text-yellow-400">0</span></p>
            <p class="text-slate-400 text-xs">Pencapaian: <span id="finalStage" class="text-emerald-400 font-bold">Stage 1</span></p>
          </div>
          <div class="flex gap-3 w-full max-w-xs">
            <button onclick="showStartMenu()" class="w-1/2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-xl transition text-xs">Pilih Stage</button>
            <button onclick="resetGame()" class="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition text-xs shadow-lg shadow-emerald-600/30">Main Lagi</button>
          </div>
        </div>
      </div>

      <!-- Tombol Arah HP -->
      <div class="grid grid-cols-3 gap-2 pt-1 max-w-[200px] mx-auto md:hidden">
        <div></div>
        <button onclick="changeDir('UP')" class="bg-slate-800 active:bg-slate-700 p-3 rounded-lg text-center font-bold">⬆️</button>
        <div></div>
        <button onclick="changeDir('LEFT')" class="bg-slate-800 active:bg-slate-700 p-3 rounded-lg text-center font-bold">⬅️</button>
        <button onclick="changeDir('DOWN')" class="bg-slate-800 active:bg-slate-700 p-3 rounded-lg text-center font-bold">⬇️</button>
        <button onclick="changeDir('RIGHT')" class="bg-slate-800 active:bg-slate-700 p-3 rounded-lg text-center font-bold">➡️</button>
      </div>
      <p class="text-center text-xs text-slate-500 hidden md:block">Kontrol: Panah Keyboard / W A S D • Garis pinggir bisa ditembus • Hati-hati ranjau bom tersembunyi!</p>
    </div>

    <script>
      let currentUser = null;
      const canvas = document.getElementById('gameCanvas');
      const ctx = canvas.getContext('2d');
      
      const grid = 20;
      const cols = canvas.width / grid;  // 48 kolom
      const rows = canvas.height / grid; // 28 baris

      let score = 0;
      let highScore = 0;
      let maxUnlockedStage = 1;

      let snake = [{ x: 5 * grid, y: 14 * grid }, { x: 4 * grid, y: 14 * grid }, { x: 3 * grid, y: 14 * grid }];
      let food = { x: 18 * grid, y: 14 * grid };
      let dx = grid, dy = 0;
      let nextDx = grid, nextDy = 0;
      let gameLoop = null;
      let isGameOver = false;
      let isGameStarted = false;

      let currentSpeed = 100;
      let soundEnabled = true;
      let bgmEnabled = true;
      let bgmTimer = null;
      let bgmStep = 0;

      let currentStage = 1;
      let foodEatenInStage = 0;
      const stageTargetFood = 10;
      let obstacles = [];
      let bombs = [];
      let explodedBomb = null;
      let tickCounter = 0;

      const stageNames = [
        "Stage 1: Empat Pilar Sudut",
        "Stage 2: Palang Tengah",
        "Stage 3: Koridor Kembar",
        "Stage 4: Gerbang Vertikal",
        "Stage 5: Empat Ruang Sekat",
        "Stage 6: Benteng Terbuka",
        "Stage 7: Labirin Zig-Zag",
        "Stage 8: Lorong Spiral",
        "Stage 9: Medan Batu Terjal",
        "Stage 10: Benteng Neraka"
      ];

      async function handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');
        const btn = document.getElementById('loginBtn');

        errorEl.classList.add('hidden');
        btn.disabled = true;
        btn.innerText = 'MEMERIKSA...';

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          const data = await res.json();

          if (data.success) {
            sessionStorage.setItem('snake_user', JSON.stringify(data.user));
            enterGame(data.user);
          } else {
            errorEl.innerText = data.message || 'Login gagal!';
            errorEl.classList.remove('hidden');
          }
        } catch (err) {
          errorEl.innerText = 'Timeout / Server tidak merespons. Cek container VPS!';
          errorEl.classList.remove('hidden');
        } finally {
          btn.disabled = false;
          btn.innerText = 'MASUK KE GAME';
        }
      }

      function enterGame(user) {
        currentUser = user;
        highScore = user.high_score || 0;
        maxUnlockedStage = Math.min(10, Math.max(1, user.max_stage || 1));

        document.getElementById('playerNameDisplay').innerText = user.username;
        document.getElementById('highScore').innerText = highScore;

        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('gameContainer').classList.remove('hidden');

        updateStageDropdown();
        loadStageObstacles(1);
        generateBombs(1);
        draw();
      }

      function logout() {
        sessionStorage.removeItem('snake_user');
        currentUser = null;
        isGameStarted = false;
        stopBgm();
        clearInterval(gameLoop);
        document.getElementById('loginPassword').value = '';
        document.getElementById('gameContainer').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
      }

      async function saveProgressToDB() {
        if (!currentUser) return;
        currentUser.high_score = highScore;
        currentUser.max_stage = maxUnlockedStage;
        sessionStorage.setItem('snake_user', JSON.stringify(currentUser));

        try {
          await fetch('/api/save-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.id,
              highScore: highScore,
              maxStage: maxUnlockedStage
            })
          });
        } catch (e) {}
      }

      const savedSession = sessionStorage.getItem('snake_user');
      if (savedSession) {
        enterGame(JSON.parse(savedSession));
      }

      function updateStageDropdown() {
        const select = document.getElementById('stageSelect');
        const currentVal = select.value || "1";
        select.innerHTML = '';

        for (let i = 1; i <= 10; i++) {
          const opt = document.createElement('option');
          opt.value = i;
          const unlocked = i <= maxUnlockedStage;
          opt.disabled = !unlocked;
          opt.innerText = unlocked 
            ? stageNames[i - 1] + " (Unlocked)" 
            : stageNames[i - 1] + " (🔒 Terkunci)";
          select.appendChild(opt);
        }
        select.value = parseInt(currentVal) <= maxUnlockedStage ? currentVal : maxUnlockedStage;
      }

      function addBrickRect(c1, r1, c2, r2) {
        for (let c = c1; c <= c2; c++) {
          for (let r = r1; r <= r2; r++) {
            if (r === 14 && c >= 0 && c <= 12) continue;
            if (!obstacles.some(o => o.x === c * grid && o.y === r * grid)) {
              obstacles.push({ x: c * grid, y: r * grid });
            }
          }
        }
      }

      function loadStageObstacles(stage) {
        obstacles = [];

        if (stage === 1) {
          addBrickRect(6, 4, 10, 6);
          addBrickRect(37, 4, 41, 6);
          addBrickRect(6, 21, 10, 23);
          addBrickRect(37, 21, 41, 23);
        } else if (stage === 2) {
          addBrickRect(17, 13, 30, 13);
          addBrickRect(17, 15, 30, 15);
          addBrickRect(23, 5, 24, 12);
          addBrickRect(23, 16, 24, 22);
          addBrickRect(5, 4, 7, 5);
          addBrickRect(40, 4, 42, 5);
          addBrickRect(5, 22, 7, 23);
          addBrickRect(40, 22, 42, 23);
        } else if (stage === 3) {
          addBrickRect(7, 6, 40, 7);
          addBrickRect(7, 20, 40, 21);
          addBrickRect(14, 11, 33, 11);
          addBrickRect(14, 17, 33, 17);
        } else if (stage === 4) {
          addBrickRect(12, 3, 13, 11);
          addBrickRect(12, 17, 13, 24);
          addBrickRect(23, 5, 24, 12);
          addBrickRect(23, 16, 24, 22);
          addBrickRect(34, 3, 35, 11);
          addBrickRect(34, 17, 35, 24);
        } else if (stage === 5) {
          addBrickRect(23, 2, 24, 11);
          addBrickRect(23, 17, 24, 25);
          addBrickRect(4, 12, 19, 12);
          addBrickRect(28, 12, 43, 12);
          addBrickRect(4, 16, 19, 16);
          addBrickRect(28, 16, 43, 16);
        } else if (stage === 6) {
          addBrickRect(7, 4, 20, 5);
          addBrickRect(27, 4, 40, 5);
          addBrickRect(7, 22, 20, 23);
          addBrickRect(27, 22, 40, 23);
          addBrickRect(7, 6, 8, 11);
          addBrickRect(7, 17, 8, 21);
          addBrickRect(39, 6, 40, 11);
          addBrickRect(39, 17, 40, 21);
          addBrickRect(18, 11, 29, 12);
          addBrickRect(18, 16, 29, 17);
        } else if (stage === 7) {
          addBrickRect(8, 0, 9, 11);
          addBrickRect(17, 16, 18, 27);
          addBrickRect(27, 0, 28, 11);
          addBrickRect(36, 16, 37, 27);
          addBrickRect(13, 6, 22, 7);
          addBrickRect(31, 20, 42, 21);
        } else if (stage === 8) {
          addBrickRect(5, 3, 42, 4);
          addBrickRect(41, 5, 42, 23);
          addBrickRect(5, 23, 40, 24);
          addBrickRect(5, 8, 6, 22);
          addBrickRect(11, 8, 35, 9);
          addBrickRect(34, 10, 35, 19);
          addBrickRect(14, 18, 33, 19);
        } else if (stage === 9) {
          for (let c = 4; c <= 41; c += 6) {
            for (let r = 3; r <= 23; r += 5) {
              addBrickRect(c, r, c + 2, r + 1);
            }
          }
          addBrickRect(17, 11, 30, 12);
          addBrickRect(17, 16, 30, 17);
        } else if (stage >= 10) {
          addBrickRect(4, 2, 20, 3);
          addBrickRect(27, 2, 43, 3);
          addBrickRect(4, 24, 20, 25);
          addBrickRect(27, 24, 43, 25);
          addBrickRect(4, 4, 5, 11);
          addBrickRect(4, 17, 5, 23);
          addBrickRect(42, 4, 43, 11);
          addBrickRect(42, 17, 43, 23);
          addBrickRect(11, 7, 19, 8);
          addBrickRect(28, 7, 36, 8);
          addBrickRect(11, 19, 19, 20);
          addBrickRect(28, 19, 36, 20);
          addBrickRect(15, 11, 16, 12);
          addBrickRect(31, 11, 32, 12);
          addBrickRect(15, 16, 16, 17);
          addBrickRect(31, 16, 32, 17);
          addBrickRect(23, 5, 24, 11);
          addBrickRect(23, 17, 24, 22);
        }
      }

      function generateBombs(stage) {
        bombs = [];
        explodedBomb = null;
        const totalBombs = Math.min(18, 2 + stage);
        let attempts = 0;

        while (bombs.length < totalBombs && attempts < 500) {
          attempts++;
          const c = Math.floor(Math.random() * cols);
          const r = Math.floor(Math.random() * rows);
          const bx = c * grid;
          const by = r * grid;

          if (r >= 13 && r <= 15 && c >= 0 && c <= 14) continue;
          const onObs = obstacles.some(o => o.x === bx && o.y === by);
          const onSnake = snake.some(s => s.x === bx && s.y === by);
          const onFood = (food.x === bx && food.y === by);
          const onBomb = bombs.some(b => b.x === bx && b.y === by);

          if (!onObs && !onSnake && !onFood && !onBomb) {
            bombs.push({ x: bx, y: by });
          }
        }
        document.getElementById('bombCountDisplay').innerText = bombs.length + ' 💣';
      }

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // MUSIK LATAR (BGM) ALA PUBG MOBILE CLASSIC THEME (32-step epic minor synth + war drum)
      const melodyNotes = [
        164.81, 0, 246.94, 0, 246.94, 261.63, 246.94, 220.00,
        196.00, 0, 220.00, 0, 196.00, 185.00, 164.81, 0,
        164.81, 0, 246.94, 0, 293.66, 329.63, 293.66, 246.94,
        261.63, 0, 246.94, 220.00, 246.94, 0, 0, 0
      ];
      const bassNotes = [
        82.41, 82.41, 0, 82.41, 82.41, 82.41, 0, 82.41,
        65.41, 65.41, 0, 65.41, 73.42, 73.42, 82.41, 0,
        82.41, 82.41, 0, 82.41, 98.00, 98.00, 0, 98.00,
        65.41, 65.41, 73.42, 73.42, 82.41, 82.41, 82.41, 0
      ];

      function playBgmStep() {
        if (!bgmEnabled || !isGameStarted || isGameOver) return;
        try {
          if (audioCtx.state === 'suspended') audioCtx.resume();
          const now = audioCtx.currentTime;
          const idx = bgmStep % melodyNotes.length;

          // Epic String/Brass Lead ala PUBG Mobile Classic Lobby
          const leadFreq = melodyNotes[idx];
          if (leadFreq > 0) {
            const osc = audioCtx.createOscillator();
            const filter = audioCtx.createBiquadFilter();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(leadFreq, now);
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1050, now);
            gain.gain.setValueAtTime(0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.35);
          }

          // Deep Sub-Bass & War Drum Kick
          const bassFreq = bassNotes[idx];
          if (bassFreq > 0) {
            const bOsc = audioCtx.createOscillator();
            const bGain = audioCtx.createGain();
            bOsc.type = 'triangle';
            bOsc.frequency.setValueAtTime(bassFreq, now);
            bOsc.frequency.exponentialRampToValueAtTime(bassFreq * 0.75, now + 0.18);
            bGain.gain.setValueAtTime(0.22, now);
            bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            bOsc.connect(bGain);
            bGain.connect(audioCtx.destination);
            bOsc.start(now);
            bOsc.stop(now + 0.23);
          }

          bgmStep++;
        } catch (e) {}
      }

      function startBgm() {
        stopBgm();
        if (!bgmEnabled) return;
        const stepInterval = Math.max(145, 200 - (currentStage * 5));
        playBgmStep();
        bgmTimer = setInterval(playBgmStep, stepInterval);
      }

      function stopBgm() {
        if (bgmTimer) {
          clearInterval(bgmTimer);
          bgmTimer = null;
        }
      }

      function toggleBgm() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        bgmEnabled = !bgmEnabled;
        const btn = document.getElementById('bgmBtn');
        if (bgmEnabled) {
          btn.innerText = '🪂 PUBG BGM: ON';
          btn.className = 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 px-3 py-1.5 rounded-lg text-xs border border-amber-600 font-semibold transition';
          if (isGameStarted && !isGameOver) startBgm();
        } else {
          btn.innerText = '🪂 PUBG BGM: OFF';
          btn.className = 'bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1.5 rounded-lg text-xs border border-slate-700 transition';
          stopBgm();
        }
      }

      // EFEK SUARA (SFX)
      function playBeep(freq, type, duration, vol = 0.1) {
        if (!soundEnabled) return;
        try {
          if (audioCtx.state === 'suspended') audioCtx.resume();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          gain.gain.setValueAtTime(vol, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + duration);
        } catch(e){}
      }

      function playEatSound() { playBeep(587.33, 'sine', 0.15, 0.14); }
      function playRadarBeep() { playBeep(980, 'sine', 0.05, 0.08); }
      function playLevelUpSound() { 
        playBeep(440, 'sine', 0.1, 0.16); 
        setTimeout(() => playBeep(659.25, 'sine', 0.1, 0.16), 100);
        setTimeout(() => playBeep(880, 'sine', 0.25, 0.16), 200); 
      }
      function playGameOverSound() { playBeep(150, 'sawtooth', 0.4, 0.18); }
      function playExplosionSound() { 
        playBeep(90, 'sawtooth', 0.5, 0.28);
        setTimeout(() => playBeep(55, 'square', 0.4, 0.24), 60);
      }
      function playTurnSound() { playBeep(300, 'triangle', 0.04, 0.06); }

      function toggleSound() {
        soundEnabled = !soundEnabled;
        document.getElementById('soundBtn').innerText = soundEnabled ? '🔊 SFX: ON' : '🔇 SFX: OFF';
      }

      function updateProgressDisplay() {
        document.getElementById('stageDisplay').innerText = currentStage + ' / 10';
        document.getElementById('targetDisplay').innerText = foodEatenInStage + ' / ' + stageTargetFood;
      }

      function getRandomFoodPos() {
        let pos;
        let isValid = false;
        while (!isValid) {
          pos = {
            x: Math.floor(Math.random() * cols) * grid,
            y: Math.floor(Math.random() * rows) * grid
          };
          const onObstacle = obstacles.some(obs => obs.x === pos.x && obs.y === pos.y);
          const onSnake = snake.some(seg => seg.x === pos.x && seg.y === pos.y);
          const onBomb = bombs.some(b => b.x === pos.x && b.y === pos.y);
          if (!onObstacle && !onSnake && !onBomb) isValid = true;
        }
        return pos;
      }

      function changeDir(dir) {
        if (!isGameStarted || isGameOver) return;
        let turned = false;
        if (dir === 'UP' && dy === 0) { nextDx = 0; nextDy = -grid; turned = true; }
        if (dir === 'DOWN' && dy === 0) { nextDx = 0; nextDy = grid; turned = true; }
        if (dir === 'LEFT' && dx === 0) { nextDx = -grid; nextDy = 0; turned = true; }
        if (dir === 'RIGHT' && dx === 0) { nextDx = grid; nextDy = 0; turned = true; }
        if (turned) playTurnSound();
      }

      document.addEventListener('keydown', (e) => {
        if (!currentUser) return;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
          e.preventDefault();
        }
        const key = e.key.toLowerCase();
        if (e.key === 'ArrowUp' || key === 'w') changeDir('UP');
        if (e.key === 'ArrowDown' || key === 's') changeDir('DOWN');
        if (e.key === 'ArrowLeft' || key === 'a') changeDir('LEFT');
        if (e.key === 'ArrowRight' || key === 'd') changeDir('RIGHT');
      });

      let touchStartX = 0, touchStartY = 0;
      let touchEndX = 0, touchEndY = 0;

      canvas.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: false });

      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
      }, { passive: false });

      function handleSwipe() {
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        const minSwipeDistance = 20;

        if (Math.abs(diffX) > Math.abs(diffY)) {
          if (Math.abs(diffX) > minSwipeDistance) {
            if (diffX > 0) changeDir('RIGHT');
            else changeDir('LEFT');
          }
        } else {
          if (Math.abs(diffY) > minSwipeDistance) {
            if (diffY > 0) changeDir('DOWN');
            else changeDir('UP');
          }
        }
      }

      function startGameFromMenu() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const selectedStage = parseInt(document.getElementById('stageSelect').value);
        currentStage = selectedStage;
        document.getElementById('startMenuScreen').classList.add('hidden');
        document.getElementById('victoryModal').classList.add('hidden');
        resetGame();
      }

      function showStartMenu() {
        isGameStarted = false;
        stopBgm();
        clearInterval(gameLoop);
        document.getElementById('gameOverModal').classList.add('hidden');
        document.getElementById('victoryModal').classList.add('hidden');
        document.getElementById('startMenuScreen').classList.remove('hidden');
        updateStageDropdown();
      }

      function nextLevel() {
        if (currentStage >= 10) {
          isGameStarted = false;
          stopBgm();
          clearInterval(gameLoop);
          playLevelUpSound();
          if (score > highScore) {
            highScore = score;
            document.getElementById('highScore').innerText = highScore;
          }
          saveProgressToDB();
          document.getElementById('victoryScore').innerText = score;
          document.getElementById('victoryModal').classList.remove('hidden');
          return;
        }

        currentStage++;
        foodEatenInStage = 0;
        currentSpeed = Math.max(45, 105 - ((currentStage - 1) * 6));
        
        if (currentStage > maxUnlockedStage) {
          maxUnlockedStage = currentStage;
          updateStageDropdown();
          saveProgressToDB();
        }

        snake = [{ x: 5 * grid, y: 14 * grid }, { x: 4 * grid, y: 14 * grid }, { x: 3 * grid, y: 14 * grid }];
        dx = grid; dy = 0;
        nextDx = grid; nextDy = 0;

        playLevelUpSound();
        startBgm();
        loadStageObstacles(currentStage);
        generateBombs(currentStage);
        updateProgressDisplay();
        
        const banner = document.getElementById('levelUpBanner');
        banner.innerText = "🎉 STAGE " + (currentStage - 1) + " CLEARED! MASUK STAGE " + currentStage + "!";
        banner.classList.remove('hidden');
        setTimeout(() => banner.classList.add('hidden'), 2200);

        clearInterval(gameLoop);
        gameLoop = setInterval(update, currentSpeed);
      }

      function update() {
        if (!isGameStarted || isGameOver) return;
        tickCounter++;
        dx = nextDx;
        dy = nextDy;

        let newX = snake[0].x + dx;
        let newY = snake[0].y + dy;

        if (newX < 0) newX = canvas.width - grid;
        else if (newX >= canvas.width) newX = 0;

        if (newY < 0) newY = canvas.height - grid;
        else if (newY >= canvas.height) newY = 0;

        const head = { x: newX, y: newY };
        
        for (let segment of snake) {
          if (head.x === segment.x && head.y === segment.y) {
            return gameOver("💥 NABRAK BADAN SENDIRI!");
          }
        }
        for (let obs of obstacles) {
          if (head.x === obs.x && head.y === obs.y) {
            return gameOver("🧱 NABRAK TEMBOK BATA!");
          }
        }
        for (let b of bombs) {
          if (head.x === b.x && head.y === b.y) {
            explodedBomb = b;
            draw();
            return gameOver("💣 MELEDAK! KENA BOM TERSEMBUNYI!", true);
          }
        }

        const nearBomb = bombs.some(b => {
          const distGrid = Math.hypot((head.x - b.x) / grid, (head.y - b.y) / grid);
          return distGrid <= 3.2;
        });
        if (nearBomb && tickCounter % 2 === 0) {
          playRadarBeep();
        }
        
        snake.unshift(head);
        
        if (head.x === food.x && head.y === food.y) {
          score += 10 * currentStage;
          foodEatenInStage++;
          document.getElementById('score').innerText = score;
          playEatSound();
          
          if (foodEatenInStage >= stageTargetFood) {
            nextLevel();
          } else {
            updateProgressDisplay();
          }
          food = getRandomFoodPos();
        } else {
          snake.pop();
        }
        draw();
      }

      function draw() {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += grid) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += grid) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
        
        obstacles.forEach(obs => {
          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(obs.x + 1, obs.y + 1, grid - 2, grid - 2);

          ctx.fillStyle = '#dc2626';
          ctx.fillRect(obs.x + 1, obs.y + 1, grid - 2, 3);

          ctx.strokeStyle = '#450a0a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(obs.x + 1, obs.y + grid / 2);
          ctx.lineTo(obs.x + grid - 1, obs.y + grid / 2);
          ctx.moveTo(obs.x + grid / 2, obs.y + 1);
          ctx.lineTo(obs.x + grid / 2, obs.y + grid / 2);
          ctx.moveTo(obs.x + grid / 4, obs.y + grid / 2);
          ctx.lineTo(obs.x + grid / 4, obs.y + grid - 1);
          ctx.stroke();
        });

        bombs.forEach(b => {
          const distGrid = Math.hypot((snake[0].x - b.x) / grid, (snake[0].y - b.y) / grid);
          const isRevealed = isGameOver || (distGrid <= 3.2 && tickCounter % 2 === 0);

          if (isRevealed) {
            const cx = b.x + grid / 2;
            const cy = b.y + grid / 2;

            ctx.fillStyle = isGameOver ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.18)';
            ctx.beginPath();
            ctx.arc(cx, cy, grid * 0.7, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(cx, cy, grid / 2 - 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(food.x + grid/2, food.y + grid/2, grid/2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(food.x + grid/2 - 2, food.y + grid/2 - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        snake.forEach((segment, index) => {
          const centerX = segment.x + grid / 2;
          const centerY = segment.y + grid / 2;
          const radius = (grid / 2) - 1;

          ctx.beginPath();
          if (index === 0) {
            ctx.fillStyle = '#10b981';
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();

            let eye1X = centerX, eye1Y = centerY, eye2X = centerX, eye2Y = centerY;
            if (dx > 0) { eye1X = centerX + 4; eye1Y = centerY - 5; eye2X = centerX + 4; eye2Y = centerY + 5; }
            else if (dx < 0) { eye1X = centerX - 4; eye1Y = centerY - 5; eye2X = centerX - 4; eye2Y = centerY + 5; }
            else if (dy < 0) { eye1X = centerX - 5; eye1Y = centerY - 4; eye2X = centerX + 5; eye2Y = centerY - 4; }
            else if (dy > 0) { eye1X = centerX - 5; eye1Y = centerY + 4; eye2X = centerX + 5; eye2Y = centerY + 4; }

            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(eye1X, eye1Y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(eye2X, eye2Y, 3, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#000000';
            ctx.beginPath(); ctx.arc(eye1X, eye1Y, 1.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(eye2X, eye2Y, 1.3, 0, Math.PI * 2); ctx.fill();
          } else {
            const tailFactor = Math.max(0.55, 1 - (index / (snake.length + 8)));
            const bodyRadius = radius * tailFactor;

            ctx.fillStyle = index % 2 === 0 ? '#34d399' : '#059669';
            ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        if (explodedBomb) {
          const ex = explodedBomb.x + grid / 2;
          const ey = explodedBomb.y + grid / 2;
          ctx.fillStyle = 'rgba(249, 115, 22, 0.75)';
          ctx.beginPath(); ctx.arc(ex, ey, grid * 1.8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
          ctx.beginPath(); ctx.arc(ex, ey, grid * 1.0, 0, Math.PI * 2); ctx.fill();
        }
      }

      function gameOver(reason = "💥 GAME OVER!", isBomb = false) {
        isGameOver = true;
        stopBgm();
        clearInterval(gameLoop);

        if (isBomb) {
          playExplosionSound();
          const wrapper = document.getElementById('canvasWrapper');
          wrapper.classList.remove('animate-shake');
          void wrapper.offsetWidth;
          wrapper.classList.add('animate-shake');
        } else {
          playGameOverSound();
        }

        draw();

        if (score > highScore) {
          highScore = score;
          document.getElementById('highScore').innerText = highScore;
        }
        saveProgressToDB();
        document.getElementById('gameOverTitle').innerText = reason;
        document.getElementById('finalScore').innerText = score;
        document.getElementById('finalStage').innerText = stageNames[currentStage - 1];
        document.getElementById('gameOverModal').classList.remove('hidden');
      }

      function resetGame() {
        snake = [{ x: 5 * grid, y: 14 * grid }, { x: 4 * grid, y: 14 * grid }, { x: 3 * grid, y: 14 * grid }];
        dx = grid; dy = 0;
        nextDx = grid; nextDy = 0;
        score = 0; isGameOver = false; isGameStarted = true;
        foodEatenInStage = 0;
        explodedBomb = null;
        bgmStep = 0;
        currentSpeed = Math.max(45, 105 - ((currentStage - 1) * 6));

        document.getElementById('score').innerText = 0;
        document.getElementById('gameOverModal').classList.add('hidden');
        document.getElementById('victoryModal').classList.add('hidden');
        
        loadStageObstacles(currentStage);
        generateBombs(currentStage);
        updateProgressDisplay();
        food = getRandomFoodPos();
        
        startBgm();
        clearInterval(gameLoop);
        gameLoop = setInterval(update, currentSpeed);
        draw();
      }
    </script>
  </body>
  </html>
  `;

  res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store, no-cache, must-revalidate' });
  res.end(html);
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
