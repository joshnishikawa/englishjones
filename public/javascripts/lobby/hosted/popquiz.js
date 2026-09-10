/**
 * lobby/hosted/popquiz.js — Pop Quiz hosted activity (client)
 * ────────────────────────────────────────────────────────────────────────────
 * Features:
 *   1. Phase 1 Number selection (consistent with Raffle & Vote).
 *   2. Dynamic card count (whichever is larger between items and users).
 *   3. Consistent top bar: instructions/status in #activityStatus, host controls in #activityControls.
 *   4. Fixed answer dimensions — pawns sit ON answers, not inside them.
 *   5. Absolute overlay coordinates for smooth, continuous pawn gliding.
 *   6. Host pawn is hidden (host acts strictly as judge/grader).
 *   7. Real-time answer selection, host grading (+1 point reveal), winner podium, and print report.
 */
(function() {
  let currentSocket = null;
  let currentPlayer = null;
  let currentRoom = null;
  let isHost = false;
  let currentStage = 'numbers'; // 'numbers' | 'quiz' | 'gameover'
  let totalItemsCount = 0;
  let mySelectedNumber = null;
  let numberSelectionsMap = {};
  let roundChoices = [];
  let isRoundGraded = false;
  let scoresMap = {};
  let roomHostId = null;
  let currentQuestionIndex = 0;
  let totalQuestionsCount = 1;
  let lastGameOverData = null;
  let playersList = [];

  // Track active student players and positions
  const playerTokensMap = {};
  const playerPositionsMap = {}; // playerId -> targetId ('popquiz-num-1', choiceIndex, or null for dock)

  function sanitizeColor(color) {
    if (!color || typeof color !== 'string') return '#0d6efd';
    const trimmed = color.trim();
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
      return '#' + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3];
    }
    return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : '#0d6efd';
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getInitials(name) {
    if (!name || typeof name !== 'string') return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return parts.map((p) => p[0]).join('').toUpperCase();
  }

  function getPawnSvg(color) {
    const safeColor = sanitizeColor(color);
    return (
      '<svg class="img-fluid popquiz-token-pawn" width="32" height="64" viewBox="0 0 64 128" xmlns="http://www.w3.org/2000/svg">' +
      '<path transform="matrix(0.78482373,0,0,0.3410327,-40.6,58)" d="m 54.796244,189.05536 c -12.062025,-20.89204 13.56978,-65.28763 37.693831,-65.28763 24.124055,0 49.755855,44.39559 37.693825,65.28763 -12.06202,20.89204 -63.325631,20.89204 -75.387656,0 z" fill="' + safeColor + '" />' +
      '<path transform="matrix(0.45050681,0,0,0.62867557,3.2,35)" d="m 105,121.60049 c -11.851854,8.65104 -69.62828,8.77896 -81.518324,0.1805 C 11.591632,113.18252 -6.3839294,58.273407 -1.8805296,44.308232 2.6228701,30.343057 49.289789,-3.7205685 63.963086,-3.7530573 78.636384,-3.785546 125.45369,30.071092 130.01888,44.016188 134.58408,57.961284 116.85185,112.94946 105,121.60049 Z" fill="' + safeColor + '" />' +
      '<circle cx="32" cy="22" r="22" fill="' + safeColor + '" />' +
      '</svg>'
    );
  }

  function getLargePawnSvg(color) {
    const safeColor = sanitizeColor(color);
    return (
      '<svg class="img-fluid" width="56" height="112" viewBox="0 0 64 128" xmlns="http://www.w3.org/2000/svg">' +
      '<path transform="matrix(0.78482373,0,0,0.3410327,-40.6,58)" d="m 54.796244,189.05536 c -12.062025,-20.89204 13.56978,-65.28763 37.693831,-65.28763 24.124055,0 49.755855,44.39559 37.693825,65.28763 -12.06202,20.89204 -63.325631,20.89204 -75.387656,0 z" fill="' + safeColor + '" />' +
      '<path transform="matrix(0.45050681,0,0,0.62867557,3.2,35)" d="m 105,121.60049 c -11.851854,8.65104 -69.62828,8.77896 -81.518324,0.1805 C 11.591632,113.18252 -6.3839294,58.273407 -1.8805296,44.308232 2.6228701,30.343057 49.289789,-3.7205685 63.963086,-3.7530573 78.636384,-3.785546 125.45369,30.071092 130.01888,44.016188 134.58408,57.961284 116.85185,112.94946 105,121.60049 Z" fill="' + safeColor + '" />' +
      '<circle cx="32" cy="22" r="22" fill="' + safeColor + '" />' +
      '</svg>'
    );
  }

  function createPlayerToken(playerObj, score) {
    const safeColor = sanitizeColor(playerObj.color);
    const initials = getInitials(playerObj.id);
    const safeScore = score !== undefined ? score : 0;

    const $token = $('<div>', {
      class: 'popquiz-pawn-token',
      id: 'token-' + String(playerObj.id).replace(/[^a-zA-Z0-9_-]/g, '_'),
      'data-player-id': playerObj.id,
    });

    const $score = $('<div>', {
      class: 'popquiz-token-score',
      text: safeScore,
    });

    const $pawn = $(getPawnSvg(safeColor));

    const $initials = $('<div>', {
      class: 'popquiz-token-initials',
      text: initials,
      css: { color: safeColor },
    });

    $token.append($score, $pawn, $initials);
    return $token;
  }

  function setStatus(htmlOrText) {
    $('#activityStatus, #popquiz-status').html(htmlOrText);
  }

  function renderTopControls() {
    const isNumbersStage = currentStage === 'numbers';
    const isGradedQuiz = currentStage === 'quiz' && isRoundGraded;
    const showSetBtn = isHost && (isNumbersStage || isGradedQuiz);
    const isLastQ = currentQuestionIndex + 1 >= totalQuestionsCount;
    const setBtnText = isNumbersStage ? 'Next' : (isLastQ ? 'Finish' : 'Next');

    let countControlHtml = '';
    if (window.hostedNumbers) {
      countControlHtml = window.hostedNumbers.renderHostCountControl(totalItemsCount || 1, 'popquiz');
    } else {
      countControlHtml = `
        <div id="popquiz-count-control" class="hosted-count-control ${isHost && isNumbersStage ? 'd-flex' : 'd-none'} align-items-center gap-2 me-1">
          <input type="hidden" id="popquiz-total-count-input" class="hosted-total-count-input" value="${totalItemsCount || 1}" />
          <button type="button" id="popquiz-count-minus" class="btn btn-primary btn-sm px-4 fw-bold shadow-sm hosted-count-btn hosted-count-minus d-inline-flex align-items-center justify-content-center" title="Remove an item" aria-label="Remove an item" style="min-width: 80px; height: 32px; font-size: 1.25rem; line-height: 1;">−</button>
          <button type="button" id="popquiz-count-plus" class="btn btn-primary btn-sm px-4 fw-bold shadow-sm hosted-count-btn hosted-count-plus d-inline-flex align-items-center justify-content-center" title="Add an item" aria-label="Add an item" style="min-width: 80px; height: 32px; font-size: 1.25rem; line-height: 1;">+</button>
        </div>
      `;
    }

    const arrowSvg = ` <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8"/></svg>`;

    $('#activityControls').html(`
      <div id="popquiz-top-host-actions" class="${isHost ? 'd-flex' : 'd-none'} align-items-center gap-2">
        <div class="${isHost && isNumbersStage ? 'd-flex' : 'd-none'} align-items-center">
          ${countControlHtml}
        </div>
        <button id="popquiz-set-btn" class="btn btn-success btn-sm px-4 fw-bold shadow-sm d-inline-flex align-items-center justify-content-center gap-1 ${showSetBtn ? '' : 'd-none'}" style="min-width: 80px; height: 32px;">
          <span>${setBtnText}</span>${setBtnText === 'Next' ? arrowSvg : ''}
        </button>
        <button id="popquiz-print-btn" class="btn btn-dark btn-sm px-4 fw-bold shadow-sm ${currentStage === 'gameover' ? 'd-inline-flex' : 'd-none'} align-items-center justify-content-center gap-1" style="min-width: 80px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" class="align-middle">
            <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
            <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2H5zm7 2v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"/>
          </svg>
          <span>Print</span>
        </button>
      </div>
    `);
  }

  function setStage(stage) {
    currentStage = stage;
    $('.popquiz-screen').addClass('d-none');

    if (stage === 'numbers') {
      setStatus(isHost ? 'Guests are choosing numbers. Tap "Next" when ready to start the quiz.' : 'Select a number card!');
      $('#popquiz-numbers-screen').removeClass('d-none');
      $('#popquiz-quiz-screen').addClass('d-none');
      $('#popquiz-gameover-screen').addClass('d-none');

      renderTopControls();
      if (isHost) {
        $('#popquiz-arena').addClass('host-view');
        $('#popquiz-total-count-input').val(totalItemsCount || 1);
      } else {
        $('#popquiz-arena').removeClass('host-view');
      }
    } else if (stage === 'quiz') {
      $('#popquiz-numbers-screen').addClass('d-none');
      $('#popquiz-quiz-screen').removeClass('d-none');
      $('#popquiz-gameover-screen').addClass('d-none');

      if (isHost) {
        $('#popquiz-arena').addClass('host-view');
        if ($('#popquiz-top-host-actions').length === 0) renderTopControls();
        $('#popquiz-top-host-actions').removeClass('d-none').addClass('d-flex');
        $('#popquiz-count-control').addClass('d-none').removeClass('d-flex');
        const isLastQ = currentQuestionIndex + 1 >= totalQuestionsCount;
        if (isRoundGraded) {
          const arrowHtml = isLastQ ? '' : ` <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8"/></svg>`;
          $('#popquiz-set-btn').removeClass('d-none').html(`<span>${isLastQ ? 'Finish' : 'Next'}</span>${arrowHtml}`);
        } else {
          $('#popquiz-set-btn').addClass('d-none');
        }
        $('#popquiz-print-btn').addClass('d-none');
      } else {
        $('#popquiz-arena').removeClass('host-view');
        $('#popquiz-top-host-actions').addClass('d-none').removeClass('d-flex');
      }
    } else if (stage === 'gameover') {
      setStatus('🏆 Quiz Finished!');
      $('#popquiz-numbers-screen').addClass('d-none');
      $('#popquiz-quiz-screen').addClass('d-none');
      $('#popquiz-gameover-screen').removeClass('d-none');
      $('#popquiz-pawn-layer').empty();

      if (isHost) {
        $('#popquiz-arena').addClass('host-view');
        if ($('#popquiz-top-host-actions').length === 0) renderTopControls();
        $('#popquiz-top-host-actions').removeClass('d-none').addClass('d-flex');
        $('#popquiz-count-control').addClass('d-none').removeClass('d-flex');
        $('#popquiz-set-btn').addClass('d-none');
        $('#popquiz-print-btn').removeClass('d-none').addClass('d-inline-flex');
      } else {
        $('#popquiz-arena').removeClass('host-view');
        $('#popquiz-top-host-actions').addClass('d-none').removeClass('d-flex');
      }
    }

    setTimeout(() => {
      updatePawnPositions();
    }, 50);
  }

  function renderNumbersGrid(count) {
    if (window.hostedNumbers) {
      window.hostedNumbers.renderGrid($('#popquiz-numbers-container'), count, {
        idPrefix: 'popquiz',
        numberSelectionsMap,
      });
    } else {
      const $container = $('#popquiz-numbers-container');
      $container.empty();

      for (let i = 1; i <= count; i++) {
        const $card = $('<div>', {
          class: 'card popquiz-card popquiz-number-card shadow-sm border-2 rounded-4 text-center d-flex align-items-center justify-content-center bg-white',
          id: `popquiz-num-${i}`,
          'data-number': i,
        });

        const $numText = $('<div>', {
          class: 'hosted-number-text popquiz-number-text',
          text: i,
        });

        $card.append($numText);
        $container.append($card);
      }
      updateNumberCardsUI();
    }
  }

  function updateNumberCardsUI() {
    if (window.hostedNumbers) {
      window.hostedNumbers.updateCardsUI($('#popquiz-numbers-container'), numberSelectionsMap, {
        cardSelector: '.popquiz-number-card',
      });
    }
  }

  function populatePrintReport() {
    $('#popquiz-print-meta').text(`Room: ${currentPlayer ? currentPlayer.roomname : ''} | Generated: ${new Date().toLocaleString()}`);

    const $tbody = $('#popquiz-results-table-body');
    $tbody.empty();

    if (!lastGameOverData) return;

    const rawLeaderboard = lastGameOverData.leaderboard || [];
    const uniqueLeaderboardMap = new Map();
    rawLeaderboard.forEach((entry) => {
      if (entry && entry.playerId && !uniqueLeaderboardMap.has(entry.playerId) && entry.playerId !== roomHostId) {
        uniqueLeaderboardMap.set(entry.playerId, entry);
      }
    });

    const displayList = Array.from(uniqueLeaderboardMap.values());
    displayList.forEach((entry, i) => {
      const selectedNum = numberSelectionsMap[entry.playerId] !== undefined ? numberSelectionsMap[entry.playerId] : '—';
      const $tr = $('<tr>');
      $tr.append($('<td>', { text: `#${i + 1}`, class: 'text-center fw-bold' }));
      $tr.append($('<td>', { text: entry.playerId || '—', class: 'fw-bold' }));
      $tr.append($('<td>', { text: selectedNum, class: 'text-center' }));
      $tr.append($('<td>', { text: entry.score !== undefined ? entry.score : 0, class: 'text-center fw-bold' }));
      $tbody.append($tr);
    });
  }

  function updatePawnPositions(instant) {
    const $arena = $('#popquiz-arena');
    if (!$arena.length || !$arena.is(':visible')) return;

    const arenaRect = $arena[0].getBoundingClientRect();
    const $dock = $('#popquiz-staging-dock');
    if (!$dock.length) return;
    const dockRect = $dock[0].getBoundingClientRect();

    const dockPlayers = [];
    const targetElementPlayers = {}; // elementId -> [playerId]

    Object.keys(playerPositionsMap).forEach((pId) => {
      if (!playerTokensMap[pId]) return;
      const target = playerPositionsMap[pId];
      let targetElId = null;

      if (typeof target === 'string') {
        targetElId = target;
      } else if (typeof target === 'number' && target >= 0) {
        targetElId = `choice-${target}`;
      }

      if (!targetElId || !document.getElementById(targetElId)) {
        dockPlayers.push(pId);
      } else {
        targetElementPlayers[targetElId] = targetElementPlayers[targetElId] || [];
        targetElementPlayers[targetElId].push(pId);
      }
    });

    // 1. Position pawns in the staging dock (with wrapping if needed)
    if (window.hostedNumbers) {
      window.hostedNumbers.positionDockPawns($arena, $dock, playerTokensMap, dockPlayers, instant);
    } else {
      const N = dockPlayers.length;
      const dockW = dockRect.width;
      const dockPawnW = N > 24 ? 34 : (N > 14 ? 38 : 44);
      const dockPawnH = 40;
      const maxDockCols = Math.max(1, Math.floor((dockW - 20) / dockPawnW));
      const dockCols = Math.min(maxDockCols, N);
      const dockRows = Math.ceil(N / (dockCols || 1));

      const neededDockHeight = Math.max(80, (dockRows - 1) * dockPawnH + 80);
      $dock.css('min-height', neededDockHeight + 'px');

      const dockStartY = (dockRect.top - arenaRect.top) + Math.max(4, (dockRect.height - ((dockRows - 1) * dockPawnH + 75)) / 2);

      dockPlayers.forEach((pId, i) => {
        const $token = playerTokensMap[pId];
        if ($token) {
          const rowIndex = Math.floor(i / (dockCols || 1));
          const colIndex = i % (dockCols || 1);
          const itemsInThisRow = Math.min(dockCols, N - rowIndex * dockCols);
          const rowWidth = (itemsInThisRow - 1) * dockPawnW + 44;
          const rowStartX = (dockRect.left - arenaRect.left) + (dockRect.width - rowWidth) / 2;

          const posX = rowStartX + colIndex * dockPawnW;
          const posY = dockStartY + rowIndex * dockPawnH;

          $token.css('z-index', 20 + rowIndex);
          if (instant) $token.css('transition', 'none');
          $token.css('transform', `translate3d(${posX}px, ${posY}px, 0)`);
          if (instant) {
            setTimeout(() => {
              $token.css('transition', '');
            }, 30);
          }
        }
      });
    }

    // 2. Position pawns on target cards (number card or choice card) with wrapping
    Object.keys(targetElementPlayers).forEach((elId) => {
      const cardEl = document.getElementById(elId);
      if (!cardEl) return;
      const cardRect = cardEl.getBoundingClientRect();
      const list = targetElementPlayers[elId];
      const M = list.length;
      if (M === 0) return;

      const isChoiceCard = cardEl.classList.contains('popquiz-choice-card');

      if (isChoiceCard) {
        // CHOICE CARD: Place pawns wrapped below choice text
        const textEl = cardEl.querySelector('.popquiz-choice-text');
        let startAreaY = cardRect.top - arenaRect.top + 16;
        let availableHeight = cardRect.height - 24;

        if (textEl) {
          const textRect = textEl.getBoundingClientRect();
          startAreaY = textRect.bottom - arenaRect.top + 8;
          availableHeight = Math.max(60, (cardRect.bottom - arenaRect.top) - startAreaY - 8);
        }

        const paddingX = 14;
        const usableWidth = Math.max(44, cardRect.width - paddingX * 2);

        // Adaptive pawn spacing based on crowd density
        const pawnSpacingX = M > 20 ? 32 : (M > 10 ? 36 : 40);
        const pawnSpacingY = M > 20 ? 36 : (M > 10 ? 40 : 44);
        const tokenDisplayH = 75;

        const maxCols = Math.max(1, Math.floor(usableWidth / pawnSpacingX));
        const cols = Math.min(maxCols, M);
        const rows = Math.ceil(M / (cols || 1));

        const totalCrowdHeight = (rows - 1) * pawnSpacingY + tokenDisplayH;
        const crowdStartY = availableHeight > totalCrowdHeight
          ? startAreaY + (availableHeight - totalCrowdHeight) / 2
          : startAreaY + 4;

        list.forEach((pId, j) => {
          const $token = playerTokensMap[pId];
          if (!$token) return;

          const rowIndex = Math.floor(j / (cols || 1));
          const colIndex = j % (cols || 1);

          const itemsInThisRow = Math.min(cols, M - rowIndex * cols);
          const rowWidth = (itemsInThisRow - 1) * pawnSpacingX + 44;
          const rowStartX = (cardRect.left - arenaRect.left) + (cardRect.width - rowWidth) / 2;

          const posX = rowStartX + colIndex * pawnSpacingX;
          const posY = crowdStartY + rowIndex * pawnSpacingY;

          $token.css('z-index', 25 + rowIndex);

          if (instant) $token.css('transition', 'none');
          $token.css('transform', `translate3d(${posX}px, ${posY}px, 0)`);
          if (instant) {
            setTimeout(() => {
              $token.css('transition', '');
            }, 30);
          }
        });
      } else {
        // NUMBER CARD: Center pawn(s) on the card
        if (window.hostedNumbers) {
          window.hostedNumbers.positionNumberCardPawns(arenaRect, cardEl, list, playerTokensMap, instant);
        } else {
          const cardW = cardRect.width;
          const cardH = cardRect.height;
          const pawnSpacingX = 36;
          const maxCols = Math.max(1, Math.floor((cardW - 10) / pawnSpacingX));
          const cols = Math.min(maxCols, M);
          const rows = Math.ceil(M / (cols || 1));
          const pawnSpacingY = 36;

          const startY = (cardRect.top - arenaRect.top) + Math.max(2, (cardH - ((rows - 1) * pawnSpacingY + 70)) / 2);

          list.forEach((pId, j) => {
            const $token = playerTokensMap[pId];
            if (!$token) return;

            const rowIndex = Math.floor(j / (cols || 1));
            const colIndex = j % (cols || 1);
            const itemsInThisRow = Math.min(cols, M - rowIndex * cols);
            const rowWidth = (itemsInThisRow - 1) * pawnSpacingX + 44;
            const rowStartX = (cardRect.left - arenaRect.left) + (cardW - rowWidth) / 2;

            const posX = rowStartX + colIndex * pawnSpacingX;
            const posY = startY + rowIndex * pawnSpacingY;

            $token.css('z-index', 25 + rowIndex);

            if (instant) $token.css('transition', 'none');
            $token.css('transform', `translate3d(${posX}px, ${posY}px, 0)`);
            if (instant) {
              setTimeout(() => {
                $token.css('transition', '');
              }, 30);
            }
          });
        }
      }
    });
  }

  function syncPawnsForPlayers(rawPlayers, instant) {
    const uniqueMap = new Map();
    (rawPlayers || []).forEach((p) => {
      if (p && p.id && !uniqueMap.has(p.id)) {
        uniqueMap.set(p.id, p);
      }
    });

    if (currentPlayer && currentPlayer.id && !uniqueMap.has(currentPlayer.id)) {
      uniqueMap.set(currentPlayer.id, currentPlayer);
    }

    const uniquePlayers = Array.from(uniqueMap.values());
    const studentPlayers = uniquePlayers.filter((p) => p.id !== roomHostId);
    const activePlayers = studentPlayers;

    const $pawnLayer = $('#popquiz-pawn-layer');
    if (!$pawnLayer.length) return;

    // Remove any stale tokens not present in activePlayers
    Object.keys(playerTokensMap).forEach((pId) => {
      if (!activePlayers.some((p) => p.id === pId)) {
        if (playerTokensMap[pId]) {
          playerTokensMap[pId].remove();
        }
        delete playerTokensMap[pId];
        delete playerPositionsMap[pId];
      }
    });

    activePlayers.forEach((p) => {
      if (!playerTokensMap[p.id]) {
        const $token = createPlayerToken(p, scoresMap[p.id] || 0);
        $pawnLayer.append($token);
        playerTokensMap[p.id] = $token;
        if (playerPositionsMap[p.id] === undefined || playerPositionsMap[p.id] === null) {
          if (currentStage === 'numbers' && numberSelectionsMap[p.id]) {
            playerPositionsMap[p.id] = `popquiz-num-${numberSelectionsMap[p.id]}`;
          } else {
            playerPositionsMap[p.id] = null;
          }
        }
      } else {
        const $score = playerTokensMap[p.id].find('.popquiz-token-score');
        if ($score.length && scoresMap[p.id] !== undefined) {
          $score.text(scoresMap[p.id]);
        }
        if (currentStage === 'numbers' && numberSelectionsMap[p.id] && (!playerPositionsMap[p.id] || playerPositionsMap[p.id] === null)) {
          playerPositionsMap[p.id] = `popquiz-num-${numberSelectionsMap[p.id]}`;
        }
      }
    });

    setTimeout(() => {
      updatePawnPositions(Boolean(instant));
    }, 30);
  }

  function mount(options) {
    currentSocket = options.socket;
    currentPlayer = options.player;
    currentRoom = options.room;
    roomHostId = (currentRoom && currentRoom.hostId) ? currentRoom.hostId : null;
    isHost = Boolean(
      options.isHost ||
      (roomHostId && currentPlayer && currentPlayer.id === roomHostId) ||
      (currentRoom && Array.isArray(currentRoom.players) && currentRoom.players.length > 0 && currentRoom.players[0].id === (currentPlayer && currentPlayer.id)) ||
      (currentPlayer && currentPlayer.isHost)
    );
    currentStage = 'numbers';
    mySelectedNumber = null;
    numberSelectionsMap = {};
    isRoundGraded = false;
    scoresMap = {};
    lastGameOverData = null;
    playersList = (currentRoom && Array.isArray(currentRoom.players)) ? currentRoom.players : [];

    // Clear previous state
    Object.keys(playerTokensMap).forEach((k) => delete playerTokensMap[k]);
    Object.keys(playerPositionsMap).forEach((k) => delete playerPositionsMap[k]);

    renderTopControls();
    setStage('numbers');

    $('#popquiz-choices-container').empty();
    $('#popquiz-pawn-layer').empty();

    // Resize and beforeprint listeners
    $(window).off('resize.popquiz').on('resize.popquiz', function() {
      updatePawnPositions(true);
    });

    window.addEventListener('beforeprint', populatePrintReport);

    // Socket Event Handlers
    currentSocket.on('setColor', function(data) {
      if (!data) return;
      if (currentPlayer && (data.number === currentPlayer.number || data.id === currentPlayer.id)) {
        currentPlayer.color = data.color;
      }
    });

    currentSocket.on('playerLeft', function(data) {
      const remaining = Array.isArray(data) ? data : (data && data.players ? data.players : []);
      playersList = remaining;
      syncPawnsForPlayers(playersList);
    });

    currentSocket.on('setName', function(data) {
      if (!data || !data.id) return;
      if (data.number === 1 || (currentRoom && currentRoom.hostId === data.id)) {
        roomHostId = data.id;
        if (currentPlayer) {
          isHost = Boolean(currentPlayer.id === roomHostId);
          if (isHost) {
            $('#popquiz-arena').addClass('host-view');
          } else {
            $('#popquiz-arena').removeClass('host-view');
          }
          renderTopControls();
        }
      }
    });

    // Handle full state sync
    currentSocket.on('popquiz/sync', function(data) {
      if (!data) return;
      totalItemsCount = data.totalCount || 0;
      if ($('#popquiz-total-count-input').length && !$('#popquiz-total-count-input').is(':focus')) {
        $('#popquiz-total-count-input').val(totalItemsCount || 1);
      }

      if (data.hostId) {
        roomHostId = data.hostId;
      }
      if (roomHostId && currentPlayer) {
        isHost = Boolean(currentPlayer.id === roomHostId);
      } else if (currentRoom && Array.isArray(currentRoom.players) && currentRoom.players.length > 0 && currentRoom.players[0].id === (currentPlayer && currentPlayer.id)) {
        isHost = true;
      }

      playersList = data.players || playersList;
      if (data.scores) scoresMap = data.scores;

      if (isHost) {
        $('#popquiz-arena').addClass('host-view');
      } else {
        $('#popquiz-arena').removeClass('host-view');
      }
      renderTopControls();

      if (data.stage === 'numbers') {
        if (data.numberSelections) {
          numberSelectionsMap = data.numberSelections;
          Object.keys(data.numberSelections).forEach((pId) => {
            const num = data.numberSelections[pId];
            playerPositionsMap[pId] = num ? `popquiz-num-${num}` : null;
          });
        }
        renderNumbersGrid(totalItemsCount);
      } else if (data.stage === 'quiz') {
        currentQuestionIndex = data.questionIndex || 0;
        totalQuestionsCount = data.totalQuestions || 1;
        isRoundGraded = Boolean(data.graded);
        if (data.choices) roundChoices = data.choices;
        if (isRoundGraded && data.correctChoiceIndex !== null && data.correctChoiceIndex !== undefined) {
          const correctIndex = Number(data.correctChoiceIndex);
          $('.popquiz-choice-card').each(function() {
            const idx = Number($(this).data('index'));
            if (idx === correctIndex) {
              $(this).addClass('popquiz-choice-correct');
            } else {
              $(this).addClass('popquiz-choice-incorrect');
            }
          });
        }
      }

      syncPawnsForPlayers(playersList);
      setStage(data.stage || 'numbers');
    });

    // Handle dynamic player sync
    currentSocket.on('popquiz/playersync', function(data) {
      if (!data) return;
      if (data.hostId) {
        roomHostId = data.hostId;
        if (currentPlayer) {
          isHost = Boolean(currentPlayer.id === roomHostId);
        }
      }
      if (data.scores) scoresMap = data.scores;
      playersList = data.players || playersList;
      syncPawnsForPlayers(playersList, false);
    });

    // Handle number selected in Phase 1
    currentSocket.on('popquiz/numberSelected', function(data) {
      if (!data) return;
      numberSelectionsMap[data.playerId] = data.number;
      playerPositionsMap[data.playerId] = data.number ? `popquiz-num-${data.number}` : null;

      if (currentPlayer && data.playerId === currentPlayer.id) {
        mySelectedNumber = data.number;
      }

      updateNumberCardsUI();
      updatePawnPositions();
    });

    // Handle new quiz round
    currentSocket.on('popquiz/roundstart', function(data) {
      isRoundGraded = false;
      roundChoices = data.choices || [];
      scoresMap = data.scores || {};
      if (data.hostId) roomHostId = data.hostId;
      if (roomHostId && currentPlayer) {
        isHost = Boolean(currentPlayer.id === roomHostId);
      }

      currentQuestionIndex = data.questionIndex || 0;
      totalQuestionsCount = data.totalQuestions || 1;
      const qIndex = currentQuestionIndex + 1;
      const totalQ = totalQuestionsCount;

      if (isHost) {
        setStatus(`Question ${qIndex} of ${totalQ}: Tap correct answer to grade`);
        if ($('#popquiz-top-host-actions').length === 0) renderTopControls();
        $('#popquiz-top-host-actions').removeClass('d-none').addClass('d-flex');
        $('#popquiz-set-btn').addClass('d-none');
        $('#popquiz-print-btn').addClass('d-none');
      } else {
        setStatus(`Question ${qIndex} of ${totalQ}: Select your answer!`);
        $('#popquiz-top-host-actions').addClass('d-none').removeClass('d-flex');
      }

      // Render choice cards: 2x2 grid for 4 choices, full screen taking
      const $container = $('#popquiz-choices-container');
      $container.empty();

      let colClass = 'col-sm-6 col-12';
      if (roundChoices.length === 2) {
        colClass = 'col-sm-6 col-12';
      } else if (roundChoices.length === 3) {
        colClass = 'col-md-4 col-sm-6 col-12';
      } else if (roundChoices.length === 4) {
        colClass = 'col-6'; // 2x2 grid filling width and height!
      } else {
        colClass = 'col-md-4 col-sm-6 col-12';
      }

      roundChoices.forEach((choiceText, index) => {
        const $col = $('<div>', { class: colClass + ' d-flex' });
        const $card = $('<div>', {
          class: 'popquiz-choice-card w-100 flex-grow-1',
          id: `choice-${index}`,
          'data-index': index,
        });

        const $text = $('<div>', {
          class: 'popquiz-choice-text',
          text: choiceText,
        });

        $card.append($text);
        $col.append($card);
        $container.append($col);
      });

      // Reset choice positions to dock for all players on new round start
      Object.keys(playerPositionsMap).forEach((k) => {
        playerPositionsMap[k] = null;
      });

      const rawPlayers = data.players || (currentRoom ? currentRoom.players : [currentPlayer]);
      syncPawnsForPlayers(rawPlayers, true);
      setStage('quiz');
    });

    // Handle player choice selection — smooth pawn glide
    currentSocket.on('popquiz/playerselected', function(data) {
      if (data.playerId === roomHostId) return; // Ignore host selections

      playerPositionsMap[data.playerId] = data.choiceIndex;
      updatePawnPositions(false);

      if (currentPlayer && data.playerId === currentPlayer.id) {
        $('.popquiz-choice-card').removeClass('popquiz-choice-selected');
        $(`#choice-${data.choiceIndex}`).addClass('popquiz-choice-selected');
        const qIndex = currentQuestionIndex + 1;
        setStatus(`Question ${qIndex} of ${totalQuestionsCount}: Answer selected! Waiting for host...`);
      }
    });

    // Handle host grading results
    currentSocket.on('popquiz/graded', function(data) {
      isRoundGraded = true;
      scoresMap = data.scores || {};

      const correctIndex = data.correctChoiceIndex;
      const correctWord = roundChoices[correctIndex] || '';

      $('.popquiz-choice-card').each(function() {
        const idx = Number($(this).data('index'));
        if (idx === correctIndex) {
          $(this).addClass('popquiz-choice-correct');
        } else {
          $(this).addClass('popquiz-choice-incorrect');
        }
      });

      // Update scores and trigger visual +1 pulse
      if (data.results && Array.isArray(data.results)) {
        data.results.forEach((res) => {
          const $token = playerTokensMap[res.playerId];
          if ($token && $token.length) {
            const $score = $token.find('.popquiz-token-score');
            $score.text(res.score);
            if (res.correct) {
              $score.addClass('score-plus');
            }
          }
        });
      }

      const safeWord = escapeHtml(correctWord);
      const isLastQ = (currentQuestionIndex + 1 >= totalQuestionsCount) || data.isGameOver;

      if (isHost) {
        setStatus(`<span class="text-success fw-bold">Correct: ${safeWord}!</span> Tap "${isLastQ ? 'Finish' : 'Next'}" to continue.`);
        if ($('#popquiz-top-host-actions').length === 0) renderTopControls();
        $('#popquiz-top-host-actions').removeClass('d-none').addClass('d-flex');
        const arrowHtml = isLastQ ? '' : ` <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8"/></svg>`;
        $('#popquiz-set-btn')
          .removeClass('d-none')
          .html(`<span>${isLastQ ? 'Finish' : 'Next'}</span>${arrowHtml}`);
      } else {
        setStatus(`<span class="text-success fw-bold">Correct: ${safeWord}!</span> Waiting for host...`);
        $('#popquiz-set-btn').addClass('d-none');
      }
    });

    // Handle game over / winner podium
    currentSocket.on('popquiz/gameover', function(data) {
      lastGameOverData = data;
      setStage('gameover');

      const $winnersContainer = $('#popquiz-winners-container');
      $winnersContainer.empty();

      const winners = data.winners || [];
      const rawLeaderboard = data.leaderboard || [];

      // Deduplicate leaderboard strictly by playerId
      const uniqueLeaderboardMap = new Map();
      rawLeaderboard.forEach((entry) => {
        if (entry && entry.playerId && !uniqueLeaderboardMap.has(entry.playerId) && entry.playerId !== roomHostId) {
          uniqueLeaderboardMap.set(entry.playerId, entry);
        }
      });

      const displayList = Array.from(uniqueLeaderboardMap.values());

      displayList.forEach((entry, i) => {
        const isWinner = winners.some((w) => w.playerId === entry.playerId);
        const playerObj = entry.player || { id: entry.playerId, color: '#0d6efd' };
        const safeColor = sanitizeColor(playerObj.color);
        const initials = getInitials(playerObj.id);

        const $col = $('<div>', { class: 'col-md-3 col-sm-6 col-12' });
        const $card = $('<div>', {
          class: `popquiz-podium-card ${isWinner ? 'popquiz-winner-card' : ''}`,
        });

        const trophyIcon = isWinner ? '<div class="fs-1 mb-2">👑</div>' : `<div class="badge bg-secondary mb-2">#${i + 1}</div>`;
        const pawnSvg = getLargePawnSvg(safeColor);
        const safeId = escapeHtml(playerObj.id);
        const safeInitials = escapeHtml(initials);
        const safeScore = parseInt(entry.score, 10) || 0;

        $card.html(`
          ${trophyIcon}
          <div class="mb-2">${pawnSvg}</div>
          <div class="fs-4 fw-bold mb-1" style="color: ${safeColor}">${safeInitials}</div>
          <div class="small text-muted mb-2">${safeId}</div>
          <div class="fs-5 fw-extrabold text-primary">Score: ${safeScore}</div>
        `);

        $col.append($card);
        $winnersContainer.append($col);
      });

      populatePrintReport();
    });

    // Notify server that player is ready
    currentSocket.emit('popquiz/ready', {
      roomname: currentPlayer.roomname,
      playerId: currentPlayer.id,
      playerNumber: currentPlayer.number,
      color: currentPlayer.color,
      isHost,
      hostId: roomHostId,
      roomPlayers: currentRoom ? currentRoom.players : [currentPlayer],
      questions: isHost ? (options.questions || window.popquizQuestions || null) : null,
    });

    // Initial pawn sync
    syncPawnsForPlayers(playersList);

    // DOM Handlers
    // 1. Select Number (Phase 1)
    $(document).off('click.popquiz', '.popquiz-number-card').on('click.popquiz', '.popquiz-number-card', function() {
      if (isHost || currentStage !== 'numbers') return;
      const num = $(this).data('number');
      mySelectedNumber = num;

      currentSocket.emit('popquiz/selectNumber', {
        roomname: currentPlayer.roomname,
        playerId: currentPlayer.id,
        number: num,
      });
    });

    // 2. Host advances (Phase 1 -> Phase 2 OR Next Question in Phase 2)
    $(document).off('click.popquiz', '#popquiz-set-btn').on('click.popquiz', '#popquiz-set-btn', function() {
      if (!isHost) return;
      if (currentStage === 'numbers') {
        currentSocket.emit('popquiz/setNumbers', {
          roomname: currentPlayer.roomname,
          id: currentPlayer.id,
        });
      } else if (currentStage === 'quiz' && isRoundGraded) {
        currentSocket.emit('popquiz/nextRound', {
          roomname: currentPlayer.roomname,
          id: currentPlayer.id,
        });
      }
    });

    // 2b. Host direct editing of item count (Phase 1)
    if (window.hostedNumbers) {
      window.hostedNumbers.bindHostCountInput('#popquiz-total-count-input', () => isHost, () => currentStage, (val) => {
        currentSocket.emit('popquiz/setTotalCount', {
          roomname: currentPlayer.roomname,
          id: currentPlayer.id,
          totalCount: val,
        });
      });
    }

    // 3. Interactive Choice Click (Phase 2)
    $(document).off('click.popquiz', '.popquiz-choice-card').on('click.popquiz', '.popquiz-choice-card', function() {
      if (isRoundGraded || currentStage !== 'quiz') return;
      const choiceIndex = Number($(this).data('index'));

      if (isHost) {
        currentSocket.emit('popquiz/grade', {
          roomname: currentPlayer.roomname,
          id: currentPlayer.id,
          correctChoiceIndex: choiceIndex,
        });
      } else {
        currentSocket.emit('popquiz/select', {
          roomname: currentPlayer.roomname,
          playerId: currentPlayer.id,
          playerNumber: currentPlayer.number,
          color: currentPlayer.color,
          choiceIndex,
        });
      }
    });

    // 4. Print Results Button (Phase 3)
    $(document).off('click.popquiz', '#popquiz-print-btn').on('click.popquiz', '#popquiz-print-btn', function() {
      populatePrintReport();
      setTimeout(() => {
        window.print();
      }, 50);
    });
  }

  function teardown(socket) {
    $(window).off('resize.popquiz');
    window.removeEventListener('beforeprint', populatePrintReport);
    $(document).off('.popquiz');
    $('#activityStatus').empty();
    $('#activityControls').empty();
    if (socket) {
      socket.off('setColor');
      socket.off('setName');
      socket.off('playerLeft');
      socket.off('popquiz/sync');
      socket.off('popquiz/playersync');
      socket.off('popquiz/numberSelected');
      socket.off('popquiz/roundstart');
      socket.off('popquiz/playerselected');
      socket.off('popquiz/graded');
      socket.off('popquiz/gameover');
    }
  }

  window.hostedActivities = window.hostedActivities || {};
  window.hostedActivities.popquiz = {
    mount,
    teardown,
  };

  window.multiplayerActivities = window.multiplayerActivities || {};
  window.multiplayerActivities.popquiz = window.hostedActivities.popquiz;
})();
