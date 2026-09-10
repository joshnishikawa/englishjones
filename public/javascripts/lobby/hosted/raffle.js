/**
 * lobby/hosted/raffle.js — Raffle hosted activity (client)
 */

(function() {
  let currentSocket = null;
  let currentPlayer = null;
  let currentRoom = null;
  let isHost = false;
  let currentStage = 'numbers';
  let totalItemsCount = 0;
  let roomEmojis = [];
  let roomValues = [];
  let roomHostId = null;
  let mySelectedNumber = null;
  let mySelectedEmojiIndex = null;

  // Track players and pawn positions
  const playerTokensMap = {};
  const playerPositionsMap = {}; // playerId -> targetCardId (e.g. 'raffle-num-2', 'raffle-emoji-0', 'raffle-flip-0', or null for dock)
  let playersList = [];
  let numberSelectionsMap = {}; // playerId -> number
  let claimedEmojiMap = {}; // emojiIndex -> playerId

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
      '<svg class="img-fluid raffle-token-pawn" width="32" height="64" viewBox="0 0 64 128" xmlns="http://www.w3.org/2000/svg">' +
      '<path transform="matrix(0.78482373,0,0,0.3410327,-40.6,58)" d="m 54.796244,189.05536 c -12.062025,-20.89204 13.56978,-65.28763 37.693831,-65.28763 24.124055,0 49.755855,44.39559 37.693825,65.28763 -12.06202,20.89204 -63.325631,20.89204 -75.387656,0 z" fill="' + safeColor + '" />' +
      '<path transform="matrix(0.45050681,0,0,0.62867557,3.2,35)" d="m 105,121.60049 c -11.851854,8.65104 -69.62828,8.77896 -81.518324,0.1805 C 11.591632,113.18252 -6.3839294,58.273407 -1.8805296,44.308232 2.6228701,30.343057 49.289789,-3.7205685 63.963086,-3.7530573 78.636384,-3.785546 125.45369,30.071092 130.01888,44.016188 134.58408,57.961284 116.85185,112.94946 105,121.60049 Z" fill="' + safeColor + '" />' +
      '<circle cx="32" cy="22" r="22" fill="' + safeColor + '" />' +
      '</svg>'
    );
  }

  function createPlayerToken(playerObj) {
    const safeColor = sanitizeColor(playerObj.color);
    const initials = getInitials(playerObj.id);

    const $token = $('<div>', {
      class: 'raffle-pawn-token',
      id: 'token-' + String(playerObj.id).replace(/[^a-zA-Z0-9_-]/g, '_'),
      'data-player-id': playerObj.id,
    });

    const $pawn = $(getPawnSvg(safeColor));

    const $initials = $('<div>', {
      class: 'raffle-token-initials',
      text: initials,
      css: { color: safeColor },
    });

    $token.append($pawn, $initials);
    return $token;
  }

  function syncPawnsForPlayers(rawPlayers) {
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

    const $pawnLayer = $('#raffle-pawn-layer');
    if (!$pawnLayer.length) return;

    // Remove tokens for inactive players
    Object.keys(playerTokensMap).forEach((pId) => {
      if (!activePlayers.some((p) => p.id === pId)) {
        if (playerTokensMap[pId]) {
          playerTokensMap[pId].remove();
        }
        delete playerTokensMap[pId];
        delete playerPositionsMap[pId];
      }
    });

    // Create tokens for active players
    activePlayers.forEach((p) => {
      if (!playerTokensMap[p.id]) {
        const $token = createPlayerToken(p);
        playerTokensMap[p.id] = $token;
        $pawnLayer.append($token);
      }
      if (playerPositionsMap[p.id] === undefined || playerPositionsMap[p.id] === null) {
        if (currentStage === 'numbers' && numberSelectionsMap[p.id]) {
          playerPositionsMap[p.id] = `raffle-num-${numberSelectionsMap[p.id]}`;
        } else if (currentStage === 'emojis') {
          const claimedIdx = Object.keys(claimedEmojiMap).find((k) => claimedEmojiMap[k] === p.id);
          playerPositionsMap[p.id] = claimedIdx !== undefined ? `raffle-emoji-${claimedIdx}` : null;
        } else if (currentStage === 'revealed') {
          const claimedIdx = Object.keys(claimedEmojiMap).find((k) => claimedEmojiMap[k] === p.id);
          playerPositionsMap[p.id] = claimedIdx !== undefined ? `raffle-flip-${claimedIdx}` : null;
        } else {
          playerPositionsMap[p.id] = null;
        }
      }
    });

    setTimeout(() => {
      updatePawnPositions();
    }, 50);
  }

  function updatePawnPositions(instant) {
    const $arena = $('#raffle-arena');
    if (!$arena.length || !$arena.is(':visible')) return;

    const arenaRect = $arena[0].getBoundingClientRect();
    const $dock = $('#raffle-staging-dock');
    if (!$dock.length) return;
    const dockRect = $dock[0].getBoundingClientRect();

    const dockPlayers = [];
    const cardPlayers = {}; // targetElementId -> [playerId]

    Object.keys(playerPositionsMap).forEach((pId) => {
      if (!playerTokensMap[pId]) return;
      const targetId = playerPositionsMap[pId];
      if (!targetId || !document.getElementById(targetId)) {
        dockPlayers.push(pId);
      } else {
        cardPlayers[targetId] = cardPlayers[targetId] || [];
        cardPlayers[targetId].push(pId);
      }
    });

    // 1. Position pawns in the staging dock
    if (window.hostedNumbers) {
      window.hostedNumbers.positionDockPawns($arena, $dock, playerTokensMap, dockPlayers, instant);
    } else {
      const N = dockPlayers.length;
      const dockSpacing = 52;
      const dockTotalWidth = N * dockSpacing;
      const dockStartX = (dockRect.left - arenaRect.left) + Math.max(0, (dockRect.width - dockTotalWidth) / 2);
      const dockStartY = (dockRect.top - arenaRect.top) + (dockRect.height - 72) / 2;

      dockPlayers.forEach((pId, i) => {
        const $token = playerTokensMap[pId];
        if ($token) {
          if (instant) $token.css('transition', 'none');
          $token.css('transform', `translate3d(${dockStartX + i * dockSpacing + 4}px, ${dockStartY}px, 0)`);
          if (instant) {
            setTimeout(() => {
              $token.css('transition', '');
            }, 30);
          }
        }
      });
    }

    // 2. Position pawns on target cards
    Object.keys(cardPlayers).forEach((targetId) => {
      const cardEl = document.getElementById(targetId);
      if (!cardEl) return;
      const list = cardPlayers[targetId];
      if (list.length === 0) return;

      const isNumberCard = cardEl.classList.contains('raffle-number-card');
      if (isNumberCard && window.hostedNumbers) {
        window.hostedNumbers.positionNumberCardPawns(arenaRect, cardEl, list, playerTokensMap, instant);
      } else {
        const cardRect = cardEl.getBoundingClientRect();
        const M = list.length;
        const pawnSpacing = 36;
        const pawnsWidth = M * pawnSpacing;
        const rightPadding = 6;
        const bottomPadding = 4;
        const cardStartX = (cardRect.right - arenaRect.left) - pawnsWidth - rightPadding;
        const cardStartY = (cardRect.bottom - arenaRect.top) - 72 - bottomPadding;

        list.forEach((pId, j) => {
          const $token = playerTokensMap[pId];
          if ($token) {
            if (instant) $token.css('transition', 'none');
            $token.css('transform', `translate3d(${cardStartX + j * pawnSpacing}px, ${cardStartY}px, 0)`);
            if (instant) {
              setTimeout(() => {
                $token.css('transition', '');
              }, 30);
            }
          }
        });
      }
    });
  }

  function renderNumbersGrid(count) {
    if (window.hostedNumbers) {
      window.hostedNumbers.renderGrid($('#raffle-numbers-container'), count, {
        idPrefix: 'raffle',
        numberSelectionsMap,
      });
    } else {
      const $container = $('#raffle-numbers-container');
      $container.empty();

      for (let i = 1; i <= count; i++) {
        const $card = $('<div>', {
          class: 'card raffle-card raffle-number-card shadow-sm border-2 rounded-4 text-center d-flex align-items-center justify-content-center bg-white',
          id: `raffle-num-${i}`,
          'data-number': i,
        });

        const $numText = $('<div>', {
          class: 'hosted-number-text raffle-number-text',
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
      window.hostedNumbers.updateCardsUI($('#raffle-numbers-container'), numberSelectionsMap, {
        cardSelector: '.raffle-number-card',
      });
    }
  }

  function renderEmojisGrid(emojis) {
    const $container = $('#raffle-emojis-container');
    $container.empty();

    emojis.forEach((emoji, idx) => {
      const $col = $('<div>', { class: 'col' });
      const $card = $('<div>', {
        class: 'card raffle-card raffle-emoji-card h-100 shadow-sm border-2 rounded-4 text-center d-flex align-items-center justify-content-center bg-white',
        id: `raffle-emoji-${idx}`,
        'data-index': idx,
      });

      const $emojiText = $('<div>', {
        class: 'display-4 lh-1',
        text: emoji,
      });

      $card.append($emojiText);
      $col.append($card);
      $container.append($col);
    });

    updateEmojiCardsUI();
  }

  function updateEmojiCardsUI() {
    $('.raffle-emoji-card').each(function() {
      const idx = $(this).data('index');
      const claimingPlayerId = claimedEmojiMap[idx];

      if (claimingPlayerId) {
        $(this).addClass('card-muted').removeClass('locked');
      } else {
        $(this).removeClass('card-muted');
        if (mySelectedEmojiIndex !== null) {
          $(this).addClass('locked');
        } else {
          $(this).removeClass('locked');
        }
      }
    });
  }

  function renderRevealedCards(shuffledValues, emojis) {
    const $container = $('#raffle-reveal-container');
    $container.empty();

    emojis.forEach((emoji, idx) => {
      const prizeValue = shuffledValues[idx] || '—';
      const claimingPlayerId = claimedEmojiMap[idx];

      const $col = $('<div>', { class: 'col' });
      const $flipCard = $('<div>', {
        class: 'raffle-flip-card w-100',
        id: `raffle-flip-${idx}`,
      });

      const $inner = $('<div>', { class: 'raffle-flip-inner' });

      // Front face: Emoji
      const $front = $('<div>', {
        class: 'card raffle-flip-front shadow-sm border-2 rounded-4 text-center d-flex align-items-center justify-content-center bg-white p-2',
      });
      $front.append($('<div>', { class: 'display-4 lh-1', text: emoji }));

      // Back face: Revealed Value / Prize
      const $back = $('<div>', {
        class: `card raffle-flip-back shadow-sm border-2 rounded-4 text-center d-flex align-items-center justify-content-center bg-success bg-opacity-10 border-success p-2 ${claimingPlayerId ? 'has-winner' : ''}`,
      });
      $back.append($('<div>', { class: 'fs-5 fw-bold text-success text-break px-1', text: prizeValue }));

      $inner.append($front, $back);
      $flipCard.append($inner);
      $col.append($flipCard);
      $container.append($col);
    });

    // 3D flip card cascade animation
    setTimeout(() => {
      $('.raffle-flip-card').each(function(i) {
        setTimeout(() => {
          $(this).addClass('is-flipped');
        }, i * 100);
      });
    }, 300);
  }

  function populatePrintTable(results) {
    const $tbody = $('#raffle-results-table-body');
    $tbody.empty();

    if (Array.isArray(results)) {
      results.forEach((row) => {
        const $tr = $('<tr>');
        $tr.append($('<td>', { text: row.playerId || '—' }));
        $tr.append($('<td>', { text: row.selectedNumber !== null ? row.selectedNumber : '—' }));
        $tr.append($('<td>', { text: row.revealedValue || '—' }));
        $tbody.append($tr);
      });
    }
  }

  function setStatus(text) {
    $('#activityStatus, #raffle-status').text(text);
  }

  function renderTopControls() {
    const isNumbersStage = currentStage === 'numbers';
    let countControlHtml = '';
    if (window.hostedNumbers) {
      countControlHtml = window.hostedNumbers.renderHostCountControl(totalItemsCount || 1, 'raffle');
    } else {
      countControlHtml = `
        <div id="raffle-count-control" class="hosted-count-control ${isHost && isNumbersStage ? 'd-flex' : 'd-none'} align-items-center gap-2 me-1">
          <input type="hidden" id="raffle-total-count-input" class="hosted-total-count-input" value="${totalItemsCount || 1}" />
          <button type="button" id="raffle-count-minus" class="btn btn-primary btn-sm px-4 fw-bold shadow-sm hosted-count-btn hosted-count-minus d-inline-flex align-items-center justify-content-center" title="Remove an item" aria-label="Remove an item" style="min-width: 80px; height: 32px; font-size: 1.25rem; line-height: 1;">−</button>
          <button type="button" id="raffle-count-plus" class="btn btn-primary btn-sm px-4 fw-bold shadow-sm hosted-count-btn hosted-count-plus d-inline-flex align-items-center justify-content-center" title="Add an item" aria-label="Add an item" style="min-width: 80px; height: 32px; font-size: 1.25rem; line-height: 1;">+</button>
        </div>
      `;
    }

    $('#activityControls').html(`
      <div id="raffle-top-host-actions" class="${isHost ? 'd-flex' : 'd-none'} align-items-center gap-2">
        <div class="${isHost && isNumbersStage ? 'd-flex' : 'd-none'} align-items-center">
          ${countControlHtml}
        </div>
        <button id="raffle-set-btn" class="btn btn-success btn-sm px-4 fw-bold shadow-sm d-inline-flex align-items-center justify-content-center gap-1 ${isNumbersStage ? '' : 'd-none'}" style="min-width: 80px; height: 32px;">
          <span>Next</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8"/>
          </svg>
        </button>
        <button id="raffle-go-btn" class="btn btn-success btn-sm px-4 fw-bold shadow-sm d-none" style="min-width: 80px;">
          Flip
        </button>
        <button id="raffle-print-btn" class="btn btn-dark btn-sm px-4 fw-bold shadow-sm d-none d-inline-flex align-items-center justify-content-center gap-1" style="min-width: 80px;">
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
    $('.raffle-screen').addClass('d-none');

    if (stage === 'numbers') {
      setStatus(isHost ? 'Guests are choosing numbers. Tap "Next" when ready.' : 'Select a number card!');
      $('#raffle-numbers-screen').removeClass('d-none');

      renderTopControls();
      if (isHost) {
        $('#raffle-arena').addClass('host-view');
        $('#raffle-total-count-input').val(totalItemsCount || 1);
      } else {
        $('#raffle-arena').removeClass('host-view');
      }
    } else if (stage === 'emojis') {
      setStatus(isHost ? 'Guests are picking emojis. Tap "Flip" to reveal prizes.' : (mySelectedEmojiIndex !== null ? 'Emoji selected! Waiting for reveal...' : 'Pick an emoji! (One per guest)'));
      $('#raffle-emojis-screen').removeClass('d-none');

      if (isHost) {
        $('#raffle-arena').addClass('host-view');
        if ($('#raffle-top-host-actions').length === 0) renderTopControls();
        $('#raffle-top-host-actions').removeClass('d-none').addClass('d-flex');
        $('#raffle-count-control').addClass('d-none').removeClass('d-flex');
        $('#raffle-go-btn').removeClass('d-none');
        $('#raffle-set-btn, #raffle-print-btn').addClass('d-none');
      } else {
        $('#raffle-arena').removeClass('host-view');
        $('#raffle-top-host-actions').addClass('d-none').removeClass('d-flex');
      }
    } else if (stage === 'revealed') {
      setStatus('🎉 Prizes Revealed!');
      $('#raffle-reveal-screen').removeClass('d-none');

      if (isHost) {
        $('#raffle-arena').addClass('host-view');
        if ($('#raffle-top-host-actions').length === 0) renderTopControls();
        $('#raffle-top-host-actions').removeClass('d-none').addClass('d-flex');
        $('#raffle-count-control').addClass('d-none').removeClass('d-flex');
        $('#raffle-print-btn').removeClass('d-none');
        $('#raffle-set-btn, #raffle-go-btn').addClass('d-none');
      } else {
        $('#raffle-arena').removeClass('host-view');
        $('#raffle-top-host-actions').addClass('d-none').removeClass('d-flex');
      }
    }

    setTimeout(() => {
      updatePawnPositions();
    }, 50);
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
    mySelectedEmojiIndex = null;
    claimedEmojiMap = {};
    playersList = (currentRoom && Array.isArray(currentRoom.players)) ? currentRoom.players : [];

    renderTopControls();
    setStage('numbers');

    // Clear pawn maps
    Object.keys(playerTokensMap).forEach((id) => {
      playerTokensMap[id].remove();
      delete playerTokensMap[id];
    });
    Object.keys(playerPositionsMap).forEach((id) => {
      delete playerPositionsMap[id];
    });

    // Parse options.values only if host
    let valuesArray = null;
    if (isHost && options.values) {
      if (Array.isArray(options.values)) {
        valuesArray = options.values;
      } else if (typeof options.values === 'string') {
        valuesArray = options.values.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    // Resize listener for pawn positions
    $(window).off('resize.raffle').on('resize.raffle', function() {
      updatePawnPositions(true);
    });

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
            $('#raffle-arena').addClass('host-view');
          } else {
            $('#raffle-arena').removeClass('host-view');
          }
          renderTopControls();
        }
      }
    });

    currentSocket.on('raffle/sync', function(data) {
      if (!data) return;
      totalItemsCount = data.totalCount || 0;
      roomEmojis = data.emojis || [];
      if (data.hostId) {
        roomHostId = data.hostId;
      }
      if (roomHostId && currentPlayer) {
        isHost = Boolean(currentPlayer.id === roomHostId);
      } else if (currentRoom && Array.isArray(currentRoom.players) && currentRoom.players.length > 0 && currentRoom.players[0].id === (currentPlayer && currentPlayer.id)) {
        isHost = true;
      }

      playersList = data.players || playersList;
      claimedEmojiMap = data.claimedEmojis || {};

      if (isHost) {
        $('#raffle-arena').addClass('host-view');
      } else {
        $('#raffle-arena').removeClass('host-view');
      }

      if (data.totalCount) {
        totalItemsCount = data.totalCount;
      }
      if ($('#raffle-total-count-input').length && !$('#raffle-total-count-input').is(':focus')) {
        $('#raffle-total-count-input').val(totalItemsCount || 1);
      }
      renderTopControls();

      if (data.stage === 'numbers') {
        if (data.numberSelections) {
          numberSelectionsMap = data.numberSelections;
          Object.keys(data.numberSelections).forEach((pId) => {
            const num = data.numberSelections[pId];
            playerPositionsMap[pId] = num ? `raffle-num-${num}` : null;
          });
        }
        renderNumbersGrid(totalItemsCount);
      } else if (data.stage === 'emojis') {
        renderEmojisGrid(roomEmojis);
        if (data.claimedEmojis) {
          Object.keys(data.claimedEmojis).forEach((idx) => {
            const pId = data.claimedEmojis[idx];
            playerPositionsMap[pId] = `raffle-emoji-${idx}`;
          });
          updateEmojiCardsUI();
        }
      } else if (data.stage === 'revealed' && data.values) {
        roomValues = data.values;
        renderRevealedCards(data.values, roomEmojis);
        if (data.claimedEmojis) {
          Object.keys(data.claimedEmojis).forEach((idx) => {
            const pId = data.claimedEmojis[idx];
            playerPositionsMap[pId] = `raffle-flip-${idx}`;
          });
        }
      }

      syncPawnsForPlayers(playersList);
      setStage(data.stage);
    });

    currentSocket.on('raffle/numberSelected', function(data) {
      if (!data) return;
      numberSelectionsMap[data.playerId] = data.number;
      playerPositionsMap[data.playerId] = data.number ? `raffle-num-${data.number}` : null;

      if (currentPlayer && data.playerId === currentPlayer.id) {
        mySelectedNumber = data.number;
      }

      updateNumberCardsUI();
      updatePawnPositions();
    });

    currentSocket.on('raffle/stageChanged', function(data) {
      if (!data) return;
      roomEmojis = data.emojis || roomEmojis;
      totalItemsCount = data.totalCount || totalItemsCount;

      if (data.stage === 'emojis') {
        // Reset all pawns to dock for phase 2
        Object.keys(playerPositionsMap).forEach((pId) => {
          playerPositionsMap[pId] = null;
        });
        renderEmojisGrid(roomEmojis);
      }

      setStage(data.stage);
    });

    currentSocket.on('raffle/emojiSelected', function(data) {
      if (!data) return;
      claimedEmojiMap[data.emojiIndex] = data.playerId;
      playerPositionsMap[data.playerId] = `raffle-emoji-${data.emojiIndex}`;

      if (data.player && !playersList.some((p) => p.id === data.playerId)) {
        playersList.push(data.player);
        syncPawnsForPlayers(playersList);
      }

      if (currentPlayer && data.playerId === currentPlayer.id) {
        mySelectedEmojiIndex = data.emojiIndex;
        setStatus('Emoji selected! Waiting for reveal...');
      }

      updateEmojiCardsUI();
      updatePawnPositions();
    });

    currentSocket.on('raffle/revealed', function(data) {
      if (!data) return;
      roomValues = data.shuffledValues;
      claimedEmojiMap = data.claimedEmojis || claimedEmojiMap;

      renderRevealedCards(data.shuffledValues, data.emojis || roomEmojis);

      // Move pawns to flip cards
      Object.keys(claimedEmojiMap).forEach((idx) => {
        const pId = claimedEmojiMap[idx];
        playerPositionsMap[pId] = `raffle-flip-${idx}`;
      });

      populatePrintTable(data.results);
      setStage('revealed');
    });

    // Emit ready signal
    currentSocket.emit('raffle/ready', {
      roomname: currentPlayer.roomname,
      playerId: currentPlayer.id,
      playerNumber: currentPlayer.number,
      color: currentPlayer.color,
      isHost: isHost,
      values: isHost ? valuesArray : null,
      roomPlayers: currentRoom ? currentRoom.players : [],
    });

    // Initial pawn sync
    syncPawnsForPlayers(playersList);

    // DOM Handlers
    // 1. Select Number (Phase 1)
    $(document).off('click.raffle', '.raffle-number-card').on('click.raffle', '.raffle-number-card', function() {
      if (isHost || currentStage !== 'numbers') return;
      const num = $(this).data('number');
      mySelectedNumber = num;

      currentSocket.emit('raffle/selectNumber', {
        roomname: currentPlayer.roomname,
        playerId: currentPlayer.id,
        number: num,
      });
    });

    // 2. Set Numbers (Host Click at top)
    $(document).off('click.raffle', '#raffle-set-btn').on('click.raffle', '#raffle-set-btn', function() {
      if (!isHost || currentStage !== 'numbers') return;
      currentSocket.emit('raffle/setNumbers', {
        roomname: currentPlayer.roomname,
        id: currentPlayer.id,
      });
    });

    // 2b. Host direct editing of item count (Phase 1)
    if (window.hostedNumbers) {
      window.hostedNumbers.bindHostCountInput('#raffle-total-count-input', () => isHost, () => currentStage, (val) => {
        currentSocket.emit('raffle/setTotalCount', {
          roomname: currentPlayer.roomname,
          id: currentPlayer.id,
          totalCount: val,
        });
      });
    }

    // 3. Select Emoji (Phase 2)
    $(document).off('click.raffle', '.raffle-emoji-card').on('click.raffle', '.raffle-emoji-card', function() {
      if (isHost || currentStage !== 'emojis') return;
      if (mySelectedEmojiIndex !== null) return;

      const idx = $(this).data('index');
      if (claimedEmojiMap[idx]) return;

      currentSocket.emit('raffle/selectEmoji', {
        roomname: currentPlayer.roomname,
        playerId: currentPlayer.id,
        playerNumber: currentPlayer.number,
        color: currentPlayer.color,
        emojiIndex: idx,
      });
    });

    // 4. GO! Reveal (Host Click at top)
    $(document).off('click.raffle', '#raffle-go-btn').on('click.raffle', '#raffle-go-btn', function() {
      if (!isHost || currentStage !== 'emojis') return;
      currentSocket.emit('raffle/reveal', {
        roomname: currentPlayer.roomname,
        id: currentPlayer.id,
      });
    });

    // 5. Print Results Table (Host Click at top)
    $(document).off('click.raffle', '#raffle-print-btn').on('click.raffle', '#raffle-print-btn', function() {
      window.print();
    });
  }

  function teardown(socket) {
    $(window).off('resize.raffle');
    $(document).off('.raffle');
    $('#activityStatus').empty();
    $('#activityControls').empty();
    if (socket) {
      socket.off('setColor');
      socket.off('setName');
      socket.off('playerLeft');
      socket.off('raffle/sync');
      socket.off('raffle/numberSelected');
      socket.off('raffle/stageChanged');
      socket.off('raffle/emojiSelected');
      socket.off('raffle/revealed');
    }
  }

  window.hostedActivities = window.hostedActivities || {};
  window.hostedActivities.raffle = {
    mount,
    teardown,
  };

  window.multiplayerActivities = window.multiplayerActivities || {};
  window.multiplayerActivities.raffle = window.hostedActivities.raffle;
})();
