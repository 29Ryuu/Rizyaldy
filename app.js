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
        <div class="relative flex justify-center items-center">
          <canvas id="gameCanvas" width="320" height="320" class="bg-slate-950 rounded-xl border border-slate-700 shadow-inner"></canvas>
          <div id="gameOverModal" class="hidden absolute inset-0 bg-slate-950/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center space-y-3">
            <h2 class="text-2xl font-bold text-red-500">GAME OVER!</h2>
            <p class="text-slate-300 text-sm">Skor Akhir: <span id="finalScore" class="font-bold text-yellow-400">0</span></p>
            <button onclick="resetGame()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl transition text-sm shadow-lg shadow-emerald-600/30">Main Lagi</button>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 pt-1 max-w-[200px] mx-auto sm:hidden">
          <div></div>
          <button onclick="changeDir('UP')" class="bg-slate-700 active:bg-slate-600 p-3 rounded-lg text-center font-bold">⬆️</button>
          <div></div>
          <button onclick="changeDir('LEFT')" class="bg-slate-700 active:bg-slate-600 p-3 rounded-lg text-center font-bold">⬅️</button>
          <button onclick="changeDir('DOWN')" class="bg-slate-700 active:bg-slate-600 p-3 rounded-lg text-center font-bold">⬇️</button>
          <button onclick="changeDir('RIGHT')" class="bg-slate-700 active:bg-slate-600 p-3 rounded-lg text-center font-bold">➡️</button>
        </div>
        <p class="text-center text-xs text-slate-500 hidden sm:block">Gunakan tombol panah ⬅️ ⬆️ ➡️ ⬇️ di keyboard untuk bergerak</p>
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

        function getRandomFoodPos() {
          return {
            x: Math.floor(Math.random() * count) * grid,
            y: Math.floor(Math.random() * count) * grid
          };
        }
        function changeDir(dir) {
          if (dir === 'UP' && dy === 0) { dx = 0; dy = -grid; }
          if (dir === 'DOWN' && dy === 0) { dx = 0; dy = grid; }
          if (dir === 'LEFT' && dx === 0) { dx = -grid; dy = 0; }
          if (dir === 'RIGHT' && dx === 0) { dx = grid; dy = 0; }
        }
        document.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp') changeDir('UP');
          if (e.key === 'ArrowDown') changeDir('DOWN');
          if (e.key === 'ArrowLeft') changeDir('LEFT');
          if (e.key === 'ArrowRight') changeDir('RIGHT');
        });
        function update() {
          if (isGameOver) return;
          const head = { x: snake[0].x + dx, y: snake[0].y + dy };
          if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) return gameOver();
          for (let segment of snake) {
            if (head.x === segment.x && head.y === segment.y) return gameOver();
          }
          snake.unshift(head);
          if (head.x === food.x && head.y === food.y) {
            score += 10;
            document.getElementById('score').innerText = score;
            food = getRandomFoodPos();
          } else {
            snake.pop();
          }
          draw();
        }
        function draw() {
          ctx.fillStyle = '#020617';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(food.x + grid/2, food.y + grid/2, grid/2 - 1, 0, Math.PI * 2);
          ctx.fill();
          snake.forEach((segment, index) => {
            ctx.fillStyle = index === 0 ? '#10b981' : '#34d399';
            ctx.fillRect(segment.x + 1, segment.y + 1, grid - 2, grid - 2);
          });
        }
        function gameOver() {
          isGameOver = true;
          clearInterval(gameLoop);
          if (score > highScore) {
            highScore = score;
            localStorage.setItem('snake_high_score', highScore);
            document.getElementById('highScore').innerText = highScore;
          }
          document.getElementById('finalScore').innerText = score;
          document.getElementById('gameOverModal').classList.remove('hidden');
        }
        function resetGame() {
          snake = [{ x: 160, y: 160 }, { x: 144, y: 160 }, { x: 128, y: 160 }];
          dx = grid; dy = 0; score = 0; isGameOver = false;
          document.getElementById('score').innerText = 0;
          document.getElementById('gameOverModal').classList.add('hidden');
          food = getRandomFoodPos();
          clearInterval(gameLoop);
          gameLoop = setInterval(update, 100);
        }
        gameLoop = setInterval(update, 100);
      </script>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.end(html);
  }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
