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
          <canvas id="gameCanvas" width="320" height="320" class="bg-slate-950 rounded-xl border border-slate-700 shadow-inner"></canvas>
          
          <!-- Modal Game Over -->
          <div id="gameOverModal" class="hidden absolute inset-0 bg-slate-950/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center space-y-3">
            <h2 class="text-2xl font-bold text-red-500">GAME OVER!</h2>
            <p class="text-slate-300 text-sm">Skor Akhir: <span id="finalScore" class="font-bold text-yellow-400">0</span></p>
            <button onclick="resetGame()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl transition text-sm shadow-lg shadow-emerald-600/30">Main Lagi</button>
          </div>
        </div>

        <!-- Tombol Arah HP -->
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

        // --- Konfigurasi Kesulitan & Kecepatan ---
        let currentSpeed = 100; // default Medium
        let soundEnabled = true;

        // --- Web Audio API Synth Generator ---
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

        function playEatSound() { playBeep(587.33, 'sine', 0.15); } // Nada nada nada tinggi pas makan
        function playGameOverSound() { playBeep(150, 'sawtooth', 0.4); } // Nada retro kasar pas mati
        function playTurnSound() { playBeep(300, 'triangle', 0.05); } // Klik halus saat belok

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
          if (dir === 'UP' && dy === 0) { dx = 0; dy = -grid; turned = true; }
          if (dir === 'DOWN' && dy === 0) { dx = 0; dy = grid; turned = true; }
          if (dir === 'LEFT' && dx === 0) { dx = -grid; dy = 0; turned = true; }
          if (dir === 'RIGHT' && dx === 0) { dx = grid; dy = 0; turned = true; }
          if (turned) playTurnSound();
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
            playEatSound();
            food = getRandomFoodPos();
          } else {
            snake.pop();
          }
          draw();
        }

        function draw() {
          // Background Arena Game
          ctx.fillStyle = '#020617';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Makanan (Apel Merah Glow)
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(food.x + grid/2, food.y + grid/2, grid/2 - 1, 0, Math.PI * 2);
          ctx.fill();
          
          // Gambar Ular (Desain Ular Realistis / Membulat + Mata)
          snake.forEach((segment, index) => {
            const centerX = segment.x + grid / 2;
            const centerY = segment.y + grid / 2;
            const radius = (grid / 2) - 1;

            ctx.beginPath();
            if (index === 0) {
              // 1. KEPALA ULAR (Hijau Terang Bulat)
              ctx.fillStyle = '#10b981';
              ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
              ctx.fill();

              // 2. MATA ULAR (Bintik Hitam & Putih)
              // Menyesuaikan posisi mata berdasarkan arah gerak (dx, dy)
              let eye1X = centerX, eye1Y = centerY, eye2X = centerX, eye2Y = centerY;
              
              if (dx > 0) { // Bergerak ke Kanan
                eye1X = centerX + 3; eye1Y = centerY - 4;
                eye2X = centerX + 3; eye2Y = centerY + 4;
              } else if (dx < 0) { // Bergerak ke Kiri
                eye1X = centerX - 3; eye1Y = centerY - 4;
                eye2X = centerX - 3; eye2Y = centerY + 4;
              } else if (dy < 0) { // Bergerak ke Atas
                eye1X = centerX - 4; eye1Y = centerY - 3;
                eye2X = centerX + 4; eye2Y = centerY - 3;
              } else if (dy > 0) { // Bergerak ke Bawah
                eye1X = centerX - 4; eye1Y = centerY + 3;
                eye2X = centerX + 4; eye2Y = centerY + 3;
              }

              // Bola Mata Putih
              ctx.fillStyle = '#ffffff';
              ctx.beginPath(); ctx.arc(eye1X, eye1Y, 2.5, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(eye2X, eye2Y, 2.5, 0, Math.PI * 2); ctx.fill();

              // Pupil Mata Hitam
              ctx.fillStyle = '#000000';
              ctx.beginPath(); ctx.arc(eye1X, eye1Y, 1, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(eye2X, eye2Y, 1, 0, Math.PI * 2); ctx.fill();

            } else {
              // 3. BADAN & EKOR ULAR (Semakin ke Ekor Semakin Mengecil)
              // Mengecilkan ukuran segmen berdasarkan indeks urutan ekor
              const tailFactor = Math.max(0.5, 1 - (index / (snake.length + 5)));
              const bodyRadius = radius * tailFactor;

              ctx.fillStyle = index % 2 === 0 ? '#34d399' : '#059669'; // Motif berselang-seling
              ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);
              ctx.fill();
            }
          });
        }

        function gameOver() {
          isGameOver = true;
          clearInterval(gameLoop);
          playGameOverSound();
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
          gameLoop = setInterval(update, currentSpeed);
        }

        // Jalankan game pertama kali
        gameLoop = setInterval(update, currentSpeed);
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