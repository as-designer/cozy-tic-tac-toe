  // ─────────────────────────────────────────────
  //  9:16 SCALE-TO-FIT  (CrazyGames requirement)
  //  The #game-container is a fixed 390 × 693 px
  //  canvas. #scale-wrapper is translated to the
  //  viewport centre and scaled so the canvas
  //  fills the screen as large as possible while
  //  keeping the 9:16 ratio intact.
  //  Outer space is the black <body> background.
  // ─────────────────────────────────────────────
  const GAME_W = 390;
  const GAME_H = 693;

  function scaleGame() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Largest uniform scale that fits both dimensions
    const scale = Math.min(vw / GAME_W, vh / GAME_H);

    const wrapper = document.getElementById('scale-wrapper');
    // Dimension of the scaled canvas
    const scaledW = GAME_W * scale;
    const scaledH = GAME_H * scale;

    // Position top-left corner so the canvas is centred
    const offsetX = (vw - scaledW) / 2;
    const offsetY = (vh - scaledH) / 2;

    wrapper.style.width  = GAME_W + 'px';
    wrapper.style.height = GAME_H + 'px';
    wrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  }

  // Scale on load and whenever the window resizes
  window.addEventListener('resize', scaleGame);
  // Also fire immediately (before DOM-ready guard below)
  scaleGame();

  // ─────────────────────────────────────────────
  //  GAME STATE
  // ─────────────────────────────────────────────
  let boardSize = 3;
  let streakToWin = 3;
  let maxRounds = 3;

  let boardState = [];
  let p1Score = 0;
  let p2Score = 0;
  let currentRound = 1;
  let currentPlayer = 'X';
  let isGameActive = false;
  let isMuted = false;

  function toggleMute() {
    isMuted = !isMuted;
    const btn  = document.getElementById('mute-btn');
    const icon = document.getElementById('mute-icon');

    icon.innerText = isMuted ? '🔇' : '🔊';
    btn.classList.toggle('muted', isMuted);

    btn.classList.remove('wiggle');
    void btn.offsetWidth;
    btn.classList.add('wiggle');
    btn.addEventListener('animationend', () => btn.classList.remove('wiggle'), { once: true });

    if (audioCtx) {
      isMuted ? audioCtx.suspend() : audioCtx.resume();
    }
  }

  window.onload = function () {
    scaleGame();   // ensure correct scale after fonts/layout settle
    setMode(3);
    setRounds(3);
  };

  // ─────────────────────────────────────────────
  //  AUDIO
  // ─────────────────────────────────────────────
  let audioCtx = null;

  function playSound(type) {
    if (isMuted) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === 'tap') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now); osc.stop(now + 0.12);

      } else if (type === 'win') {
        osc.type = 'triangle';
        [330, 392, 523, 659].forEach((f, i) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.connect(g); g.connect(audioCtx.destination);
          o.frequency.setValueAtTime(f, now + i * 0.08);
          g.gain.setValueAtTime(0.08, now + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
          o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.2);
        });

      } else if (type === 'tie') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(140, now + 0.35);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now); osc.stop(now + 0.35);

      } else if (type === 'grand-win') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.exponentialRampToValueAtTime(1046, now + 0.45);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now); osc.stop(now + 0.45);
      }
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  // ─────────────────────────────────────────────
  //  SETUP CONTROLS
  // ─────────────────────────────────────────────
  function setMode(size) {
    playSound('tap');
    boardSize = size;
    streakToWin = (size === 3 || size === 5) ? 3 : 5;

    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active-selection'));
    const btn = document.getElementById(`mode-btn-${size}`);
    if (btn) btn.classList.add('active-selection');
  }

  function setRounds(rounds) {
    playSound('tap');
    maxRounds = rounds;
    document.querySelectorAll('.rounds-btn').forEach(b => b.classList.remove('active-selection'));
    const btn = document.getElementById(`rounds-btn-${rounds}`);
    if (btn) btn.classList.add('active-selection');
  }

  // ─────────────────────────────────────────────
  //  GAME FLOW
  // ─────────────────────────────────────────────
  function startGame() {
    playSound('tap');
    p1Score = 0; p2Score = 0; currentRound = 1;
    document.getElementById('p1-score').innerText = '0';
    document.getElementById('p2-score').innerText = '0';
    document.getElementById('streak-target').innerText = streakToWin;
    currentPlayer = Math.random() < 0.5 ? 'X' : 'O';

    document.getElementById('setup-card').style.display = 'none';
    document.getElementById('game-card').style.display  = 'flex';

    initBoard();
  }

  function initBoard() {
    isGameActive = true;
    document.getElementById('round-indicator').innerText = `Round ${currentRound} of ${maxRounds}`;
    boardState = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));

    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${boardSize}, minmax(0,1fr))`;
    boardEl.style.gridTemplateRows    = `repeat(${boardSize}, minmax(0,1fr))`;

    // Show the turn banner only during play
    document.getElementById('turn-banner').style.display = 'block';

    let fontSizeClass = 'font-3x3';
    if (boardSize === 5)  fontSizeClass = 'font-5x5';
    if (boardSize === 7)  fontSizeClass = 'font-7x7';
    if (boardSize === 10) fontSizeClass = 'font-10x10';

    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const cell = document.createElement('button');
        cell.setAttribute('id', `cell-${r}-${c}`);
        cell.setAttribute('data-row', r);
        cell.setAttribute('data-col', c);
        cell.className = `game-cell ${fontSizeClass}`;
        cell.addEventListener('click', () => handleCellClick(r, c));
        boardEl.appendChild(cell);
      }
    }
    updateTurnBanner();
  }

  function updateTurnBanner() {
    const banner  = document.getElementById('turn-banner');
    const p1Panel = document.getElementById('p1-panel');
    const p2Panel = document.getElementById('p2-panel');

    p1Panel.className = 'player-panel';
    p2Panel.className = 'player-panel';

    if (currentPlayer === 'X') {
      banner.innerHTML        = `<span style="color:#FF5A79;">🌸 Player 1's Turn</span>`;
      banner.style.backgroundColor = '#FFF0F2';
      banner.style.borderColor     = '#FF5A79';
      p1Panel.className = 'player-panel p1-active';
    } else {
      banner.innerHTML        = `<span style="color:#E6A100;">⭐️ Player 2's Turn</span>`;
      banner.style.backgroundColor = '#FFFDE7';
      banner.style.borderColor     = '#FFB703';
      p2Panel.className = 'player-panel p2-active';
    }
  }

  function handleCellClick(r, c) {
    if (!isGameActive || boardState[r][c] !== null) return;
    playSound('tap');

    boardState[r][c] = currentPlayer;
    const cell = document.getElementById(`cell-${r}-${c}`);
    cell.classList.add('occupied', 'disabled');

    if (currentPlayer === 'X') {
      cell.innerHTML = `<span class="animate-pop">🌸</span>`;
      cell.classList.add('cell-x-bg');
    } else {
      cell.innerHTML = `<span class="animate-pop">⭐️</span>`;
      cell.classList.add('cell-o-bg');
    }

    if (checkWin(r, c)) {
      isGameActive = false;
      handleRoundWinner(currentPlayer);
    } else if (checkTie()) {
      isGameActive = false;
      handleRoundWinner('Tie');
    } else {
      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      updateTurnBanner();
    }
  }

  // ─────────────────────────────────────────────
  //  WIN / TIE DETECTION
  // ─────────────────────────────────────────────
  function checkWin(lastRow, lastCol) {
    const directions = [[0,1],[1,0],[1,1],[1,-1]];
    const token = boardState[lastRow][lastCol];

    for (let [dr, dc] of directions) {
      let count = 1;
      let r = lastRow + dr, c = lastCol + dc;
      while (isValidCell(r,c) && boardState[r][c] === token) { count++; r+=dr; c+=dc; }
      r = lastRow - dr; c = lastCol - dc;
      while (isValidCell(r,c) && boardState[r][c] === token) { count++; r-=dr; c-=dc; }
      if (count >= streakToWin) {
        highlightWinningStreak(lastRow, lastCol, dr, dc);
        return true;
      }
    }
    return false;
  }

  function highlightWinningStreak(row, col, dr, dc) {
    const token = boardState[row][col];
    const winCells = [[row, col]];
    let r = row+dr, c = col+dc;
    while (isValidCell(r,c) && boardState[r][c]===token) { winCells.push([r,c]); r+=dr; c+=dc; }
    r = row-dr; c = col-dc;
    while (isValidCell(r,c) && boardState[r][c]===token) { winCells.push([r,c]); r-=dr; c-=dc; }
    winCells.forEach(([wr,wc]) => {
      const cell = document.getElementById(`cell-${wr}-${wc}`);
      if (cell) {
        cell.style.backgroundColor = '#C8E6C9';
        cell.style.borderColor     = '#4CAF50';
        cell.style.transform       = 'scale(1.05)';
      }
    });
  }

  function isValidCell(r, c) {
    return r >= 0 && r < boardSize && c >= 0 && c < boardSize;
  }

  function checkTie() {
    return boardState.every(row => row.every(cell => cell !== null));
  }

  // ─────────────────────────────────────────────
  //  ROUND / MATCH RESOLUTION
  // ─────────────────────────────────────────────
  function handleRoundWinner(winner) {
    const isFinalRound = (currentRound >= maxRounds);

    if (winner === 'Tie') {
      playSound('tie');
      if (isFinalRound) {
        handleMatchResolution();
      } else {
        showPopupModal('🌈 Cozy Tie Round!', 'No points were awarded!', '🤝', false);
      }
    } else {
      playSound('win');
      if (winner === 'X') {
        p1Score++;
        document.getElementById('p1-score').innerText = p1Score;
      } else {
        p2Score++;
        document.getElementById('p2-score').innerText = p2Score;
      }
      if (isFinalRound) {
        handleMatchResolution();
      } else {
        const token = winner === 'X' ? '🌸' : '⭐️';
        const pName = winner === 'X' ? 'Player 1' : 'Player 2';
        showPopupModal(`${token} ${pName} Wins Round!`, `Score: P1(${p1Score}) vs P2(${p2Score})`, token, false);
      }
    }
  }

  function handleMatchResolution() {
    isGameActive = false;
    setTimeout(() => {
      playSound('grand-win');
      triggerConfetti();
      if (p1Score > p2Score) {
        showPopupModal('🎉 MATCH CHAMPION! 🎉', `Player 1 (🌸) wins with ${p1Score} points!`, '🌸', true);
      } else if (p2Score > p1Score) {
        showPopupModal('🎉 MATCH CHAMPION! 🎉', `Player 2 (⭐️) wins with ${p2Score} points!`, '⭐️', true);
      } else {
        showPopupModal('🤝 MATCH TIED! 🤝', `Friendly match tie: ${p1Score} – ${p2Score}!`, '🌈', true);
      }
    }, 500);
  }

  function handleRoundResolution() {
    currentRound++;
    currentPlayer = Math.random() < 0.5 ? 'X' : 'O';
    initBoard();
  }

  // ─────────────────────────────────────────────
  //  CONFETTI  (appended to #game-container so it
  //  stays inside the scaled 9:16 box)
  // ─────────────────────────────────────────────
  function triggerConfetti() {
    const colors  = ['#FF8A8A','#FFD18A','#8AFF8A','#8AD1FF','#FF8AD1'];
    const container = document.getElementById('game-container');
    for (let i = 0; i < 60; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left            = Math.random() * 100 + '%';
      confetti.style.top             = '0';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay  = Math.random() * 1.5 + 's';
      confetti.style.transform       = `scale(${Math.random() * 0.8 + 0.4})`;
      container.appendChild(confetti);
      setTimeout(() => confetti.remove(), 3000);
    }
  }

  // ─────────────────────────────────────────────
  //  MODAL
  // ─────────────────────────────────────────────
  let isGrandWinnerModal = false;

  function showPopupModal(title, subtitle, icon, isGrandMatchOver) {
    isGrandWinnerModal = isGrandMatchOver;
    document.getElementById('modal-title').innerText      = title;
    document.getElementById('modal-subtitle').innerText   = subtitle;
    document.getElementById('modal-icon').innerText       = icon;
    document.getElementById('modal-winner-token').innerText = icon;
    document.getElementById('modal-board-size').innerText = `${boardSize} × ${boardSize}`;
    document.getElementById('modal-rounds').innerText     = `${p1Score} to ${p2Score}`;

    const actionBtn = document.getElementById('modal-action-btn');
    if (isGrandMatchOver) {
      actionBtn.innerText   = '🎉 Start New Match!';
      actionBtn.className   = 'modal-action-btn cartoon-border modal-btn-pink';
    } else {
      actionBtn.innerText   = '🎮 Play Next Round!';
      actionBtn.className   = 'modal-action-btn cartoon-border modal-btn-green';
    }
    document.getElementById('popup-modal').classList.remove('hidden');
  }

  function closeModal() {
    playSound('tap');
    document.getElementById('popup-modal').classList.add('hidden');
    if (isGrandWinnerModal) {
      backToMenu();
    } else {
      handleRoundResolution();
    }
  }

  function backToMenu() {
    playSound('tap');
    isGameActive = false;
    document.getElementById('turn-banner').style.display = 'none';
    document.getElementById('game-card').style.display  = 'none';
    document.getElementById('setup-card').style.display = 'flex';
  }
