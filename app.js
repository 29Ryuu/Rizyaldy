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
});

const server = http.createServer(async (req, res) => {
  if (req.url === '/db-check') {
    try {
      const dbRes = await pool.query('SELECT NOW()');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'success',
        message: 'Koneksi ke PostgreSQL Berhasil!',
        server_time: dbRes.rows[0].now
      }));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
  } else {
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
      <title>Retro Snake Game - Docker Node.js</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col items-center justify-center p-4 font-sans select-none">
      <div class="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-700 pb-3">
          <div>
            <h1 class="font-bold text-xl text-emerald-400 flex items-center gap-2">🐍 Snake Game</h1>
            <p class="text-xs text-slate-400">Node.js + PostgreSQL Container</p>
          </div>
          <div class="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${dbConnected ? 'bg-emerald-950 text-emerald-400 border-emerald-700' : 'bg-red-950 text-red-400 border-red-700'}">
            <span class="h-2 w-2 rounded-full ${dbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}"></span>
            ${dbConnected ? 'DB Connected' : 'DB Disconnected'}
          </div>
        </div>

        <!-- Menu Kesulitan & Kontrol Suara -->
        <div class="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">
          <div class="flex items-center gap-2">
            <label for="difficulty" class="text-xs text-slate-300 font-medium">Kesulitan:</label>
            <select id="difficulty" onchange="changeDifficulty(this.value)" class="bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 border border-slate-600 focus:outline-none focus:border-emerald-500">
              <option value="150">Easy (Santai)</option>
              <option value="100" selected>Medium (Normal)</option>
              <option value="60">Hard (Ngebut)</option>
              <option value="35">Extreme (Gila)</option>
            </select>
          </div>
          <button onclick="toggleSound()" id="soundBtn" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-lg border border-slate-600 transition flex items-center gap-1">
            🔊 Sound ON
          </button>
        </div>

        <!-- Scoreboard -->
        <div class="flex justify-between items-center bg-slate-900 px-4 py-2 rounded-xl border border-slate-700/60 font-mono">
          <div>
            <span class="text-slate-400 text-xs block">SCORE</span>
            <span id="score" class="text-xl font-bold text-yellow-400">0</span>
          </div>
          <div class="text-right">
            <span class="text-slate-400 text-xs block">HIGH SCORE</span>
            <span id="highScore" class="text-xl font-bold text-indigo-400">0</span>
          </div>
        </div>

        <!-- Canvas Game -->
        <div class="relative flex justify-center items-center">
          <canvas id="gameCanvas" width="320" height="320" class="bg-slate-950 rounded-xl border border-slate-700 shadow-inner touch-none"></canvas>
          
          <!-- Modal Game Over -->
          <div id="gameOverModal" class="hidden absolute inset-0 bg-slate-950/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center space-y-3">
            <h2 class="text-2xl font-bold text-red-500">GAME OVER!</h2>
            <p class="text-slate-300 text-sm">Skor Akhir: <span id="finalScore" class="font-bold text-yellow-400">0</span></p>
            <button onclick="resetGame()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl transition text-sm shadow-lg shadow-emerald-600/30">Main Lagi</button>
          </div>
        </div>

        <!-- Tombol Arah HP (Opsional) -->
        <div class="grid grid-cols-3 gap-2 pt-1 max-w-[200px] mx-auto sm:hidden">
          <div></div>
          <button onclick="changeDir('UP')" class="bg-slate-700 active:bg-slate-600 p-3 rounded-lg text-center font-bold">⬆️</button>
          <div></div>
          <button onclick="changeDir('LEFT')" class="bg-slate-700 active:bg-slate-600 p-3 rounded-lg text-center font-bold">⬅️</button>
          <button onclick="changeDir('DOWN')" class="bg-slate-700 active:bg-slate-600 p-3 rounded-lg text-center font-bold">⬇️</button>
          <button onclick="changeDir('RIGHT')" class="bg-slate-700 active:bg-slate-600 p-3 rounded-lg text-center font-bold">➡️</button>
        </div>
        <p class="text-center text-xs text-slate-500 hidden sm:block">Swipe layar atau gunakan panah keyboard untuk bergerak</p>
      </div>

      <script>
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const grid = 16;
        const count = canvas.width / grid;
        let score = 0;
        let highScore = localStorage.getItem('snake_high_score') || 0;
        document.getElementById('highScore').innerText = highScore;

        let snake = [{ x: 160, y: 160 }, { x: 144, y: 160 }, { x: 128, y: 160 }];
        let food = { x: 80, y: 80 };
        let dx = grid, dy = 0;
        let gameLoop = null;
        let isGameOver = false;

        let currentSpeed = 100;
        let soundEnabled = true;

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        function playBeep(freq, type, duration) {
          if (!soundEnabled) return;
          try {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
          } catch(e){}
        }

        function playEatSound() { playBeep(587.33, 'sine', 0.15); } 
        function playGameOverSound() { playBeep(150, 'sawtooth', 0.4); } 
        function playTurnSound() { playBeep(300, 'triangle', 0.05); } 

        function toggleSound() {
          soundEnabled = !soundEnabled;
          document.getElementById('soundBtn').innerText = soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF';
        }

        function changeDifficulty(speed) {
          currentSpeed = parseInt(speed);
          if (!isGameOver) {
            clearInterval(gameLoop);
            gameLoop = setInterval(update, currentSpeed);
          }
        }

        function getRandomFoodPos() {
          return {
            x: Math.floor(Math.random() * count) * grid,
            y: Math.floor(Math.random() * count) * grid
          };
        }

        function changeDir(dir) {
          let turned = false;
          if (dir === 'UP' && dy === 0