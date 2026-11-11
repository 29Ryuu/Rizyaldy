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
      <div class="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4 relative overflow-hidden">
        
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

        <!-- Indicator Stage & Audio -->
        <div class="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50 text-xs">
          <div class="flex items-center gap-3">
            <div>
              <span class="text-slate-400 block">STAGE</span>
              <span id="stageDisplay" class="font-bold text-emerald-400 text-sm">STAGE 1</span>
            </div>
            <div class="border-l border-slate-700 pl-3">
              <span class="text-slate-400 block">TARGET</span>
              <span id="targetDisplay" class="font-bold text-yellow-400 text-sm">0 / 10</span>
            </div>
          </div>
          <button onclick="toggleSound()" id="soundBtn" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-lg border border-slate-600 transition">
            🔊 Sound
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

        <!-- Canvas Game & Overlay Screen -->
        <div class="relative flex justify-center items-center">
          <canvas id="gameCanvas" width="320" height="320" class="bg-slate-950 rounded-xl border border-slate-700 shadow-inner touch-none"></canvas>
          
          <!-- MENU UTAMA / START SCREEN -->
          <div id="startMenuScreen" class="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-6 space-y-4 z-20">
            <div class="text-center">
              <h2 class="text-3xl font-extrabold text-emerald-400 tracking-wider animate-pulse">SNAKE ADVENTURE</h2>
              <p class="text-xs text-slate-400 mt-1">Selesaikan tiap stage untuk membuka level baru!</p>
            </div>

            <div class="w-full space-y-1 text-center">
              <label class="text-xs text-slate-300 font-medium">Pilih Stage Awal:</label>
              <select id="stageSelect" class="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-emerald-500 text-center font-bold">
                <option value="1">Stage 1: Polos (Unlocked)</option>
                <option value="2" id="optStage2" disabled>Stage 2: Salib (🔒 Terkunci)</option>
                <option value="3" id="optStage3" disabled>Stage 3: Labirin (🔒 Terkunci)</option>
              </select>
            </div>

            <button onclick="startGameFromMenu()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition text-base shadow-lg shadow-emerald-600/30 transform active:scale-95">
              🎮 START GAME
            </button>
          </div>

          <!-- Banner Level Up -->
          <div id="levelUpBanner" class="hidden absolute top-4 bg-emerald-500 text-slate-950 font-bold px-4 py-1.5 rounded-full shadow-lg text-sm animate-bounce z-10">
            🎉 STAGE CLEARED! LEVEL UNLOCKED!
          </div>

          <!-- Modal Game Over -->
          <div id="gameOverModal" class="hidden absolute inset-0 bg-slate-950/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center space-y-3 z-20">
            <h2 class="text-2xl font-bold text-red-500">GAME OVER!</h2>
            <p class="text-slate-300 text-sm">Skor Akhir: <span id="finalScore" class="font-bold text-yellow-400">0</span></p>
            <p class="text-slate-400 text-xs">Pencapaian: <span id="finalStage" class="text-emerald-400 font-bold">Stage 1</span></p>
            <div class="flex gap-2 w-3/4">
              <button onclick="showStartMenu()" class="w-1/2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-xl transition text-xs">Menu</button>
              <button onclick="resetGame()" class="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl transition text-xs shadow-lg shadow-emerald-600/30">Main Lagi</button>
            </div>
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
        <p class="text-center text-xs text-slate-500 hidden sm:block">Swipe layar atau gunakan panah keyboard untuk bergerak</p>
      </div>

      <script>
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const grid = 16;
        const count = canvas.width / grid;
        let score = 0;
        let highScore = localStorage.getItem('snake_high_score') || 0;
        let maxUnlockedStage = parseInt(localStorage.getItem('snake_max_stage')) || 1;
        document.getElementById('highScore').innerText = highScore;

        let snake = [{ x: 160, y: 160 }, { x: 144, y: 160 }, { x: 128, y: 160 }];
        let food = { x: 80, y: 80 };
        let dx = grid, dy = 0;
        let gameLoop = null;
        let isGameOver = false;
        let isGameStarted = false;

        let currentSpeed = 110;
        let soundEnabled = true;
        let currentStage = 1;
        let foodEatenInStage = 0;
        const stageTargetFood = 10;
        let obstacles = [];

        function updateStageDropdown() {
          const opt2 = document.getElementById('optStage2');
          const opt3 = document.getElementById('optStage3');

          if (maxUnlockedStage >= 2) {
            opt2.disabled = false;
            opt2.innerText = 'Stage 2: Salib (Unlocked)';
          }
          if (maxUnlockedStage >= 3) {
            opt3.disabled = false;
            opt3.innerText = 'Stage 3: Labirin (Unlocked)';
          }
        }

        function loadStageObstacles(stage) {
          obstacles = [];
          if (stage === 2) {
            for (let i = 6; i <= 13; i++) {
              obstacles.push({ x: i * grid, y: 9 * grid });
              obstacles.push({ x: 9 * grid, y: i * grid });
            }
          } else if (stage >= 3) {
            for (let i = 3; i <= 7; i++) {
              obstacles.push({ x: i * grid, y: 3 * grid });
              obstacles.push({ x: (count - 1 - i) * grid, y: 3 * grid });
              obstacles.push({ x: i * grid, y: (count - 1 - 3) * grid });
              obstacles.push({ x: (count - 1 - i) * grid, y: (count - 1 - 3) * grid });
            }
            for (let i = 8; i <= 11; i++) {
              obstacles.push({ x: 9 * grid, y: i * grid });
            }
          }
        }

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
        function playLevelUpSound() { 
          playBeep(440, 'sine', 0.1); 
          setTimeout(() => playBeep(880, 'sine', 0.2), 100); 
        }
        function playGameOverSound() { playBeep(150, 'sawtooth', 0.4); }
        function playTurnSound() { playBeep(300, 'triangle', 0.05); }

        function toggleSound() {
          soundEnabled = !soundEnabled;
          document.getElementById('soundBtn').innerText = soundEnabled ? '🔊 Sound' : '🔇 Mute';
        }

        function updateProgressDisplay() {
          document.getElementById('stageDisplay').innerText = 'STAGE ' + currentStage;
          document.getElementById('targetDisplay').innerText = foodEatenInStage + ' / ' + stageTargetFood;
        }

        function getRandomFoodPos() {
          let pos;
          let isValid = false;
          while (!isValid) {
            pos = {
              x: Math.floor(Math.random() * count) * grid,
              y: Math.floor(Math.random() * count) * grid
            };
            const onObstacle = obstacles.some(obs => obs.x === pos.x && obs.y === pos.y);
            const onSnake = snake.some(seg => seg.x === pos.x && seg.y === pos.y);
            if (!onObstacle && !onSnake) isValid = true;
          }
          return pos;
        }

        function changeDir(dir) {
          if (!isGameStarted || isGameOver) return;
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
          const selectedStage = parseInt(document.getElementById('stageSelect').value);
          currentStage = selectedStage;
          document.getElementById('startMenuScreen').classList.add('hidden');
          resetGame();
        }

        function showStartMenu() {
          isGameStarted = false;
          clearInterval(gameLoop);
          document.getElementById('gameOverModal').classList.add('hidden');
          document.getElementById('startMenuScreen').classList.remove('hidden');
          updateStageDropdown();
        }

        function nextLevel() {
          currentStage++;
          foodEatenInStage = 0;
          currentSpeed = Math.max(45, currentSpeed - 12);
          
          if (currentStage > maxUnlockedStage) {
            maxUnlockedStage = currentStage;
            localStorage.setItem('snake_max_stage', maxUnlockedStage);
            updateStageDropdown();
          }

          playLevelUpSound();
          loadStageObstacles(currentStage);
          updateProgressDisplay();
          
          const banner = document.getElementById('levelUpBanner');
          banner.classList.remove('hidden');
          setTimeout(() => banner.classList.add('hidden'), 2000);

          clearInterval(gameLoop);
          gameLoop = setInterval(update, currentSpeed);
        }

        function update() {
          if (!isGameStarted || isGameOver) return;
          const head = { x: snake[0].x + dx, y: snake[0].y + dy };
          
          if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) return gameOver();
          for (let segment of snake) {
            if (head.x === segment.x && head.y === segment.y) return gameOver();
          }
          for (let obs of obstacles) {
            if (head.x === obs.x && head.y === obs.y) return gameOver();
          }
          
          snake.unshift(head);
          
          if (head.x === food.x && head.y === food.y) {
            score += 10;
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
          
          ctx.fillStyle = '#991b1b';
          obstacles.forEach(obs => {
            ctx.beginPath();
            ctx.roundRect(obs.x + 1, obs.y + 1, grid - 2, grid - 2, 3);
            ctx.fill();
          });

          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(food.x + grid/2, food.y + grid/2, grid/2 - 1, 0, Math.PI * 2);
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
              if (dx > 0) { eye1X = centerX + 3; eye1Y = centerY - 4; eye2X = centerX + 3; eye2Y = centerY + 4; }
              else if (dx < 0) { eye1X = centerX - 3; eye1Y = centerY - 4; eye2X = centerX - 3; eye2Y = centerY + 4; }
              else if (dy < 0) { eye1X = centerX - 4; eye1Y = centerY - 3; eye2X = centerX + 4; eye2Y = centerY - 3; }
              else if (dy > 0) { eye1X = centerX - 4; eye1Y = centerY + 3; eye2X = centerX + 4; eye2Y = centerY + 3; }

              ctx.fillStyle = '#ffffff';
              ctx.beginPath(); ctx.arc(eye1X, eye1Y, 2.5, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(eye2X, eye2Y, 2.5, 0, Math.PI * 2); ctx.fill();

              ctx.fillStyle = '#000000';
              ctx.beginPath(); ctx.arc(eye1X, eye1Y, 1, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(eye2X, eye2Y, 1, 0, Math.PI * 2); ctx.fill();

            } else {
              const tailFactor = Math.max(0.5, 1 - (index / (snake.length + 5)));
              const bodyRadius = radius * tailFactor;

              ctx.fillStyle = index % 2 === 0 ? '#34d399' : '#059669';
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
          document.getElementById('finalStage').innerText = 'Stage ' + currentStage;
          document.getElementById('gameOverModal').classList.remove('hidden');
        }

        function resetGame() {
          snake = [{ x: 160, y: 160 }, { x: 144, y: 160 }, { x: 128, y: 160 }];
          dx = grid; dy = 0; score = 0; isGameOver = false; isGameStarted = true;
          foodEatenInStage = 0;
          currentSpeed = Math.max(45, 110 - ((currentStage - 1) * 15));

          document.getElementById('score').innerText = 0;
          document.getElementById('gameOverModal').classList.add('hidden');
          
          loadStageObstacles(currentStage);
          updateProgressDisplay();
          food = getRandomFoodPos();
          
          clearInterval(gameLoop);
          gameLoop = setInterval(update, currentSpeed);
          draw();
        }

        updateStageDropdown();
        loadStageObstacles(1);
        draw();
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