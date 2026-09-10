/**
 * public/javascripts/lobby/lobby.js — Multiplayer lobby, player management, and activity coordination
 */

// CONFIG & VARIABLES ///////////////////////////////////////////////////////////
let activitiesConfig = [];
try {
  const configEl = document.getElementById('activitiesConfigData');
  if (configEl) {
    activitiesConfig = JSON.parse(configEl.textContent || '[]');
  }
} catch (e) {
  activitiesConfig = [];
}

let i18n = { pleaseSelect: 'Please select words first.' };
try {
  const i18nEl = document.getElementById('multiplayerI18nData');
  if (i18nEl) {
    i18n = Object.assign(i18n, JSON.parse(i18nEl.textContent || '{}'));
  }
} catch (e) {
  // fallback to defaults
}

let room = {};
let player = {
  id: null,
  color: "#0d6efd",
  roomname: null,
  roomtype: "private",
  closed: false,
  number: 1,
  activity: null
};
const socket = io();
let currentActivity = null;
let timer;
let latestPublicRooms = [];

// Escape HTML to prevent XSS when inserting user-controlled data into the DOM and attributes
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPublicRooms(publicRooms) {
  if (Array.isArray(publicRooms)) {
    latestPublicRooms = publicRooms;
  }
  const $container = $("#publicRoomsContainer");
  const $list = $("#publicRoomsList");
  $list.empty();

  if (!player.activity) {
    $container.hide();
    return;
  }

  const availableRooms = (latestPublicRooms || []).filter(function(r) {
    return r && r.roomname && r.roomname !== player.roomname && r.activity === player.activity;
  });

  if (availableRooms.length === 0) {
    $container.hide();
    return;
  }

  $container.show();
  availableRooms.forEach(function(r) {
    const safeRoomName = escapeHtml(r.roomname);
    let activityLabel = escapeHtml(r.activity || '');
    let isHostAct = false;
    if (r.activity && Array.isArray(activitiesConfig)) {
      const act = activitiesConfig.find(function(a) { return a.id === r.activity; });
      if (act) {
        activityLabel = escapeHtml(act.label);
        if (act.group === 'host') isHostAct = true;
      }
    }
    if (r.isHostActivity) isHostAct = true;
    const count = r.playerCount || (r.players ? r.players.length : 1);

    const $btn = $(`
      <button type="button" class="btn btn-outline-success w-100 d-flex justify-content-between align-items-center py-2 px-3 public-room-btn mb-1" data-room="${safeRoomName}" title="Join ${safeRoomName}" aria-label="Join group ${safeRoomName}">
        <span class="d-flex align-items-center gap-2">
          <i class="material-icons" style="font-size: 20px;">groups</i>
          <span class="fw-bold fs-5 text-truncate" style="max-width: 140px;">${safeRoomName}</span>
        </span>
        <span class="d-flex align-items-center gap-1">
          ${activityLabel ? `<span class="badge bg-success text-capitalize">${activityLabel}</span>` : ''}
          ${!isHostAct ? `<span class="badge bg-secondary">${count}/4</span>` : ''}
        </span>
      </button>
    `);

    $list.append($btn);
  });
}

// Sanitize CSS color values — only allow valid hex colors
function sanitizeColor(color) {
  if (!color || typeof color !== 'string') return '#0d6efd';
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return '#' + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3];
  }
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : '#0d6efd';
}

// Safely load and validate stored player data from localStorage; clear if corrupted
function loadStoredPlayer() {
  try {
    const raw = localStorage.getItem('player');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem('player');
      return null;
    }
    if (!parsed.id || typeof parsed.id !== 'string' || !parsed.id.trim()) {
      localStorage.removeItem('player');
      return null;
    }
    return {
      id: parsed.id.trim(),
      color: sanitizeColor(parsed.color),
      roomname: typeof parsed.roomname === 'string' ? parsed.roomname : null,
      roomtype: ['public', 'private'].includes(parsed.roomtype) ? parsed.roomtype : 'private',
      closed: Boolean(parsed.closed),
      number: typeof parsed.number === 'number' ? parsed.number : 1,
      activity: typeof parsed.activity === 'string' ? parsed.activity : null
    };
  } catch (e) {
    try { localStorage.removeItem('player'); } catch (err) {}
    return null;
  }
}

// Initialize global variables for NH vocabulary only if they don't exist
if (typeof window.deck === 'undefined') window.deck = [];
if (typeof window.local === 'undefined') window.local = [];
if (typeof window.deckType === 'undefined') window.deckType = 'NH';

// Define global functions only if they don't exist - Edge compatible
if (typeof window.addWords === 'undefined') {
  window.addWords = function(list) {
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      if (window.deck.indexOf(l.id) === -1) {
        window.deck.push(l.id);
        window.local.push(l);
      }
    }
  };
}

if (typeof window.removeWords === 'undefined') {
  window.removeWords = function(list) {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      window.deck = window.deck.filter(function(d) { 
        return d !== item && d !== item.id && d !== item.word; 
      });
      window.local = window.local.filter(function(l) { 
        return l.id !== item.id && l.id !== item.word; 
      });
    }
  };
}

$(function(){
  $("#multiplayer-tab").addClass("active");

  // Load and validate player data from localStorage, auto-purging leftover corrupt data
  const stored = loadStoredPlayer();
  if (stored) {
    player = stored;
  }

  // Render pawn, color, and player ID immediately on DOM ready
  $("#myPawn").html(getPawn(player.color));
  $("#color").val(player.color);
  $("#myName").text(player.id || '...').css('color', player.color);

  // Restore draft popquiz questions from localStorage
  const savedPopquizQuestions = localStorage.getItem('popquiz_questions_draft');
  if (savedPopquizQuestions) {
    $("#popquiz-questions").val(savedPopquizQuestions);
    const parsedQuestions = savedPopquizQuestions.split('\n')
      .map(function(line) {
        return line.split(',').map(function(item) { return item.trim(); }).filter(Boolean);
      })
      .filter(function(arr) { return arr.length > 0; });
    if (parsedQuestions.length > 0) {
      window.popquizQuestions = parsedQuestions;
    }
  }

  function parseValuesInput(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    const text = rawText.trim();
    if (!text) return [];
    if (text.includes('\n')) {
      return text.split('\n')
        .map(function(item) { return item.replace(/,$/, '').trim(); })
        .filter(Boolean);
    }
    return text.split(',')
      .map(function(item) { return item.trim(); })
      .filter(Boolean);
  }

  // Restore draft raffle values from localStorage
  const savedRaffleValues = localStorage.getItem('raffle_values_draft');
  if (savedRaffleValues) {
    $("#raffle-values").val(savedRaffleValues);
    const parsedValues = parseValuesInput(savedRaffleValues);
    if (parsedValues.length > 0) {
      window.raffleValues = parsedValues;
    }
  }

  // Restore draft vote values from localStorage
  const savedVoteValues = localStorage.getItem('vote_values_draft');
  if (savedVoteValues) {
    $("#vote-values").val(savedVoteValues);
    const parsedVoteValues = parseValuesInput(savedVoteValues);
    if (parsedVoteValues.length > 0) {
      window.voteValues = parsedVoteValues;
    }
  }

  $(".menuitem").on('submit', function(e){
    e.preventDefault();
    if (!window.deck || window.deck.length == 0) {
      alert(i18n.pleaseSelect || "Please select words first.");
    }
    else {
      $(e.target).find("input[name='deck']").val(JSON.stringify(window.deck));
      $(e.target).find("input[name='deckType']").val(window.deckType);
      $(e.target).off('submit').submit();
    }
  });

// FUNCTIONS ////////////////////////////////////////////////////////////////////
  function updatePlayerList(data){
    const $group = $("#group");
    const $leaveGroup = $("#leaveGroup");
    const $otherPlayers = $("#otherPlayers");
    const $activities = $(".activity");
    
    if (!data) return;
    const playersList = Array.isArray(data) ? data : (data.players || []);
    const hostSelected = (data && data.selectedHostActivity !== undefined) ? data.selectedHostActivity : (room ? room.selectedHostActivity : null);
    const roomTypeUpdate = (data && data.roomtype) ? data.roomtype : (room ? room.roomtype : player.roomtype);

    if (data && data.roomtype) {
      player.roomtype = data.roomtype;
      localStorage.setItem('player', JSON.stringify(player));
    }

    if (room) {
      room.players = playersList;
      room.selectedHostActivity = hostSelected;
      room.roomtype = roomTypeUpdate;
      if (room.players && room.players.length > 0) {
        if (!room.hostId || !room.players.some(p => p.id === room.hostId)) {
          room.hostId = room.players[0].id;
        }
      }
    }

    // Determine if group div should disappear:
    // When another player joins their room (playersList.length > 1)
    const hasOtherPlayers = playersList.length > 1;
    const shouldHideGroup = hasOtherPlayers;

    if (shouldHideGroup) {
      $group.hide().removeClass("d-flex").addClass("d-none");
      $leaveGroup.show();
    }
    else {
      $group.show().removeClass("d-none d-flex");
      $leaveGroup.hide();
    }

    $otherPlayers.empty();
    $(".host-pawn").empty();
    $(".activity-pawns").empty();
    $activities.find(".pawn").remove();

    let otherPlayersHTML = '';

    for (let i = 0; i < playersList.length; i++) {
      const p = playersList[i];
      const safeColor = sanitizeColor(p.color);
      const safeId = escapeHtml(p.id);
      const safeNum = parseInt(p.number, 10) || (i + 1);

      if (p.id == player.id || (player.number && p.number == player.number)){
        player.id = p.id;
        player.color = safeColor;
        $("#myPawn").html(getPawn(player.color));
        $("#myName").text(p.id).css('color', player.color);
        $("#color").val(player.color);
        localStorage.setItem('player', JSON.stringify(player));
      }
      else {
        otherPlayersHTML += `
          <div class="row bg-light border border-primary rounded-3 my-1">
            <div class="col-2">
              <div class="pawn${safeNum} text-center my-1" style="margin:auto;width:24px;">${getPawn(safeColor)}</div>
            </div>
            <div class="col-10">
              <div id="name${safeNum}" class="fs-4 text-break" style="color: ${safeColor};text-shadow:0px 0px 2px #555;">${safeId}</div>
            </div>
          </div>
        `;
      }
    }
    
    if (otherPlayersHTML) {
      $otherPlayers.html(otherPlayersHTML);
    }
    
    // Count player selections per activity (excluding host) and place pawns
    const hostId = room ? room.hostId : null;
    const nonHostPlayers = playersList.filter(p => p.id !== hostId);
    const activityCounts = {};

    for (let i = 0; i < playersList.length; i++) {
      const p = playersList[i];
      if (p.activity && typeof p.activity === 'string') {
        const actEl = document.getElementById(p.activity);
        if (actEl) {
          const isHostPlayer = (p.id === hostId);
          const pSafeColor = sanitizeColor(p.color);
          if (isHostPlayer) {
            // Host's pawn appears at the left of the menu item
            $(actEl).find('.host-pawn').html(getPawn(pSafeColor));
          } else {
            // Other players appear on the right and increment selection count
            activityCounts[p.activity] = (activityCounts[p.activity] || 0) + 1;
            const $targetPawns = $(actEl).find(".activity-pawns");
            if ($targetPawns.length) {
              $targetPawns.append(getPawn(pSafeColor));
            } else {
              $(actEl).append(getPawn(pSafeColor));
            }
          }
        }
      }
    }

    $(".activity").each(function() {
      const actId = $(this).attr("id");
      const isHostAct = $(this).data("group") === "host";
      let count = activityCounts[actId] || 0;
      if (isHostAct && (room.selectedHostActivity === actId || player.activity === actId || room.activity === actId)) {
        // Display number of joined players for selected host activity
        count = Math.max(count, nonHostPlayers.length);
        const $targetPawns = $(this).find(".activity-pawns");
        if (count > 0 && $targetPawns.find(".pawn").length === 0) {
          nonHostPlayers.forEach(p => {
            $targetPawns.append(getPawn(p.color));
          });
        }
      }
      $(this).find(".activity-count").text(count);
    });

    const isHost = Boolean(room && room.hostId && player.id === room.hostId);

    // Toggle host indicator and host actions for the local player only
    if (isHost) {
      $("#hostBadge").removeClass("d-none");
      $("#getName").removeClass("d-none");
      if (currentActivity) {
        $("#activityHostBadge").removeClass("d-none");
      }
    } else {
      $("#hostBadge").addClass("d-none");
      $("#getName").addClass("d-none");
      $("#activityHostBadge").addClass("d-none");
    }

    // Activity visibility management
    if (isHost) {
      $("#standardActivities").removeClass("d-none");
      $("#hostActivities").removeClass("d-none");
      $("#hostActivitiesHeader").removeClass("d-none");
      $(".host-activity-row").removeClass("d-none");

      // Show/hide Start button and config textarea based on host's selection
      $(".start-activity-btn").each(function() {
        const actId = $(this).data("activity");
        if (player.activity === actId) {
          $(this).removeClass("d-none");
        } else {
          $(this).addClass("d-none");
        }
      });

      if (player.activity === 'popquiz') {
        $("#popquiz-config").removeClass("d-none");
      } else {
        $("#popquiz-config").addClass("d-none");
      }

      if (player.activity === 'raffle') {
        $("#raffle-config").removeClass("d-none");
      } else {
        $("#raffle-config").addClass("d-none");
      }

      if (player.activity === 'vote') {
        $("#vote-config").removeClass("d-none");
      } else {
        $("#vote-config").addClass("d-none");
      }
    } else {
      // Non-host players:
      $(".start-activity-btn").addClass("d-none");
      $("#popquiz-config").addClass("d-none");
      $("#raffle-config").addClass("d-none");
      $("#vote-config").addClass("d-none");
      if (room && room.selectedHostActivity) {
        // Only show the host-selected activity
        $("#standardActivities").addClass("d-none");
        $("#hostActivities").removeClass("d-none");
        $("#hostActivitiesHeader").addClass("d-none");
        $(".host-activity-row").each(function() {
          if ($(this).attr("id") === `row-${room.selectedHostActivity}`) {
            $(this).removeClass("d-none");
          } else {
            $(this).addClass("d-none");
          }
        });
      } else {
        // Show standard activities, hide host activities
        $("#standardActivities").removeClass("d-none");
        $("#hostActivities").addClass("d-none");
      }
    }
    renderPublicRooms();
  }

  function getPawn(color) {
    const safeColor = sanitizeColor(color);
    const shadow = reduceBrightness(safeColor, 20);
    const def = shadow.replace("#", "");
    return '<svg class="img-fluid pawn" width="64" height="128" viewBox="0 0 64 128" xmlns="http://www.w3.org/2000/svg">' +
      '<!-- Body of the pawn -->' +
      '<path transform="matrix(0.78482373,0,0,0.3410327,-40.6,58)" d="m 54.796244,189.05536 c -12.062025,-20.89204 13.56978,-65.28763 37.693831,-65.28763 24.124055,0 49.755855,44.39559 37.693825,65.28763 -12.06202,20.89204 -63.325631,20.89204 -75.387656,0 z" fill="' + safeColor + '" />' +
      '<path transform="matrix(0.78482373,0,0,0.3410327,-40.6,58)" d="m 54.796244,189.05536 c -12.062025,-20.89204 13.56978,-65.28763 37.693831,-65.28763 24.124055,0 49.755855,44.39559 37.693825,65.28763 -12.06202,20.89204 -63.325631,20.89204 -75.387656,0 z" fill="url(#' + def + '1)" />' +
      '<path transform="matrix(0.45050681,0,0,0.62867557,3.2,35)" d="m 105,121.60049 c -11.851854,8.65104 -69.62828,8.77896 -81.518324,0.1805 C 11.591632,113.18252 -6.3839294,58.273407 -1.8805296,44.308232 2.6228701,30.343057 49.289789,-3.7205685 63.963086,-3.7530573 78.636384,-3.785546 125.45369,30.071092 130.01888,44.016188 134.58408,57.961284 116.85185,112.94946 105,121.60049 Z" fill="' + safeColor + '" />' +
      '<path transform="matrix(0.45050681,0,0,0.62867557,3.2,35)" d="m 105,121.60049 c -11.851854,8.65104 -69.62828,8.77896 -81.518324,0.1805 C 11.591632,113.18252 -6.3839294,58.273407 -1.8805296,44.308232 2.6228701,30.343057 49.289789,-3.7205685 63.963086,-3.7530573 78.636384,-3.785546 125.45369,30.071092 130.01888,44.016188 134.58408,57.961284 116.85185,112.94946 105,121.60049 Z" fill="url(#' + def + '1)" />' +
      '<!-- Head of the pawn -->' +
      '<circle cx="32" cy="22" r="22" fill="' + safeColor + '" />' +
      '<circle cx="32" cy="22" r="22" fill="url(#' + def + '2)" />' +
      '<!-- Shading gradients -->' +
      '<defs>' +
        '<radialGradient id="' + def + '1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">' +
          '<stop offset="50%" style="stop-color:' + shadow + ';stop-opacity:0" />' +
          '<stop offset="100%" style="stop-color:' + shadow + ';stop-opacity:1" />' +
        '</radialGradient>' +
        '<radialGradient id="' + def + '2" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">' +
          '<stop offset="50%" style="stop-color:' + shadow + ';stop-opacity:0" />' +
          '<stop offset="100%" style="stop-color:' + shadow + ';stop-opacity:1" />' +
        '</radialGradient>' +
      '</defs>' +
    '</svg>';
  }

  function reduceBrightness(hex, percent) {
    const cleanHex = sanitizeColor(hex);
    const num = parseInt(cleanHex.replace("#", ""), 16),
        amt = Math.round(2.55 * percent),
        R = Math.max(0, Math.min(255, (num >> 16) - amt)),
        G = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) - amt)),
        B = Math.max(0, Math.min(255, (num & 0x0000FF) - amt));
    return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  function getName() {
    return new Promise(function(resolve, reject) {
      socket.emit('getName', player);

      function onSetName(data) {
        if (data.id) {
          player.id = data.id;
          $("#myName").text(data.id).css('color', player.color);
          $("#myPawn").html(getPawn(player.color));
          localStorage.setItem('player', JSON.stringify(player));
          socket.off('setName', onSetName);
          resolve();
        } else {
          socket.off('setName', onSetName);
          reject('Failed to get name from server');
        }
      }

      socket.off('setName', onSetName);
      socket.on('setName', onSetName);
    });
  }

  function setColor(number, color) {
    const safeColor = sanitizeColor(color);
    if (number == player.number){
      player.color = safeColor;
      localStorage.setItem('player', JSON.stringify(player));
      $("#myPawn").html(getPawn(safeColor));
      $("#myName").css('color', safeColor);
      $("#color").val(safeColor);
      
      if (room && room.players) {
        let found = room.players.find(p => p.number == player.number || p.id == player.id);
        if (found) {
          found.color = safeColor;
        }
        updatePlayerList(room.players);
      }
      
      socket.emit('setColor', player);
    }
    else {
      $(".pawn" + number).html(getPawn(safeColor));
      $("#name" + number).css('color', safeColor);
      if (room && room.players) {
        let found = room.players.find(p => p.number == number);
        if (found) {
          found.color = safeColor;
        }
        updatePlayerList(room.players);
      }
    }
  }

  function isHostedActivity(activityId) {
    if (!activityId) return false;
    if (Array.isArray(activitiesConfig)) {
      const act = activitiesConfig.find(function(a) { return a.id === activityId; });
      if (act && act.group === 'host') return true;
    }
    if (window.hostedActivities && window.hostedActivities[activityId]) {
      return true;
    }
    return ['popquiz', 'raffle', 'vote'].includes(activityId);
  }

  function getActivityModule(activityId) {
    if (!activityId) return null;
    if (window.hostedActivities && window.hostedActivities[activityId]) {
      return window.hostedActivities[activityId];
    }
    if (window.multiplayerActivities && window.multiplayerActivities[activityId]) {
      return window.multiplayerActivities[activityId];
    }
    return null;
  }

  function loadActivity(activity) {
    if (!activity || typeof activity !== 'string') return;
    const isValid = (Array.isArray(activitiesConfig) && activitiesConfig.some(a => a.id === activity)) ||
                    ['choose', 'race', 'match', 'popquiz', 'raffle', 'vote'].includes(activity);
    if (!isValid) {
      console.warn('Attempted to load unknown activity:', activity);
      return;
    }

    const currentModule = getActivityModule(currentActivity);
    if (currentModule && typeof currentModule.teardown === "function") {
      currentModule.teardown(socket);
    }

    const loadUrl = "/lobby/" + encodeURIComponent(activity);

    $("#activityContent").load(loadUrl, function(responseText, status) {
      if (status !== "success") {
        $("#activityContent").html("<div class='alert alert-danger'>Failed to load activity.</div>");
        return;
      }

      const isHost = Boolean(room && room.hostId && player.id === room.hostId);
      currentActivity = activity;
      enterActivityMode();
      const actModule = getActivityModule(activity);
      if (actModule && typeof actModule.mount === "function") {
        actModule.mount({
          socket: socket,
          player: player,
          room: room,
          isHost: isHost,
          questions: isHost ? window.popquizQuestions : null,
          values: isHost ? ((activity === 'vote' ? window.voteValues : window.raffleValues) || window.raffleValues || window.voteValues) : null,
        });
      }
    });
  }

  function enterActivityMode() {
    $("#studentSideMenu").addClass("d-none");
    $("#lobbyColumn").addClass("d-none");
    $("#sideColumn").addClass("d-none");
    $("#activityMenu").addClass("d-none");
    $("#activityColumn").removeClass("col-sm-8").addClass("col-12");
    $("#activityExit").removeClass("d-none");
    $("#activityRoomName").text(player.roomname || (room && room.roomname) || "");
    const isHost = Boolean(room && room.hostId ? player.id === room.hostId : (player && player.number === 1));
    if (isHost) {
      $("#activityHostBadge").removeClass("d-none");
      if (isHostedActivity(currentActivity)) {
        $("#activityExit").attr("title", "End activity and return to lobby").attr("aria-label", "End activity and return to lobby");
      } else {
        $("#activityExit").attr("title", "Leave activity").attr("aria-label", "Leave activity");
      }
    } else {
      $("#activityHostBadge").addClass("d-none");
      $("#activityExit").attr("title", "Leave activity").attr("aria-label", "Leave activity");
    }
  }

  function exitActivityMode() {
    const currentModule = getActivityModule(currentActivity);
    if (currentModule && typeof currentModule.teardown === "function") {
      currentModule.teardown(socket);
    }
    currentActivity = null;

    $("#studentSideMenu").removeClass("d-none");
    $("#activityContent").empty();
    $("#activityStatus").empty();
    $("#activityControls").empty();
    $("#activityExit").addClass("d-none").attr("title", "Leave activity").attr("aria-label", "Leave activity");
    $("#activityHostBadge").addClass("d-none");
    $("#activityRoomName").empty();
    $("#activityColumn").removeClass("col-12").addClass("col-sm-8");
    $("#activityMenu").removeClass("d-none");
    $("#lobbyColumn").removeClass("d-none");
    $("#sideColumn").removeClass("d-none");
  }


// EVENTS //////////////////////////////////////////////////////////////////////
  let roomSearchTimeout;
  $("#roomSearch").on('focus', function(){
    const current = $(this).attr('placeholder');
    if (current) {
      $(this).data('placeholder', current);
      $(this).attr('placeholder', '');
    }
  }).on('blur', function(){
    const orig = $(this).data('placeholder') || 'join';
    $(this).attr('placeholder', orig);
  });

  $("#roomSearch").on('input', function(){
    clearTimeout(roomSearchTimeout);
    const query = $("#roomSearch").val().trim().toLowerCase();
    if (!query) {
      $("#foundplayers").empty();
      $("#join").prop('disabled', true);
      return;
    }
    // Enable button immediately when user inputs text so they can submit without waiting
    $("#join").prop('disabled', false);
    roomSearchTimeout = setTimeout(function() {
      socket.emit('roomSearch', query);
    }, 300); // Wait 300ms after user stops typing
  });

  $("#roomSearchForm").on('submit', function(e){
    e.preventDefault();
    clearTimeout(roomSearchTimeout);
    const newRoom = $("#roomSearch").val().trim().toLowerCase();
    if (!newRoom) return;
    socket.emit('join', {newRoom: newRoom, player: player});
    $("#roomSearch").val('');
    $("#foundplayers").empty();
    $("#join").prop('disabled', true);
  });

  $("#getName").on('click', function() {
    const isHost = Boolean(room && room.hostId ? player.id === room.hostId : (player && player.number === 1));
    if (!isHost) return;
    getName();
  });

  $("#color").on('change', function(){
    const color = $("#color").val();
    setColor(player.number, color);
  });

  $("#leaveGroup").on('click', function(){
    socket.emit('leave', player);
    // Don't trigger room search here - let the server handle the rejoin
  });

  $("#activityExit").on('click', function(){
    const isHost = Boolean(room && room.hostId ? player.id === room.hostId : (player && player.number === 1));
    if (isHost && isHostedActivity(currentActivity)) {
      if (window.confirm("Do you want to end the activity and return to the lobby?")) {
        socket.emit("activityComplete", {
          roomname: player.roomname || (room && room.roomname),
          activity: currentActivity,
        });
      }
      return;
    }

    socket.emit('leave', player);
  });

  $(document).on("click", ".public-room-btn", function(e) {
    e.preventDefault();
    const targetRoom = $(this).data("room");
    if (!targetRoom) return;
    socket.emit("join", { newRoom: String(targetRoom).trim().toLowerCase(), player: player });
  });

  $(document).on("click", ".activity", function () {
    const activity = $(this).attr("id");
    if (player.activity === activity) {
      player.activity = null;
    } else {
      player.activity = activity;
    }
    localStorage.setItem('player', JSON.stringify(player));
    renderPublicRooms();
    socket.emit("chooseActivity", player);
  });

  $(document).on("input change", "#popquiz-questions", function () {
    const rawVal = $(this).val() || '';
    try {
      localStorage.setItem('popquiz_questions_draft', rawVal);
    } catch (e) {}

    const rawText = rawVal.trim();
    let questions = null;
    if (rawText) {
      questions = rawText.split('\n')
        .map(function(line) {
          return line.split(',').map(function(item) { return item.trim(); }).filter(Boolean);
        })
        .filter(function(arr) { return arr.length > 0; });
    }
    if (questions && questions.length > 0) {
      window.popquizQuestions = questions;
      socket.emit("popquiz/updateQuestions", {
        roomname: player.roomname,
        id: player.id,
        questions: questions,
      });
    }
  });

  $(document).on("input change", "#raffle-values", function () {
    const rawVal = $(this).val() || '';
    try {
      localStorage.setItem('raffle_values_draft', rawVal);
    } catch (e) {}

    const values = parseValuesInput(rawVal);
    if (values && values.length > 0) {
      window.raffleValues = values;
      socket.emit("raffle/updateValues", {
        roomname: player.roomname,
        id: player.id,
        values: values,
      });
    }
  });

  $(document).on("input change", "#vote-values", function () {
    const rawVal = $(this).val() || '';
    try {
      localStorage.setItem('vote_values_draft', rawVal);
    } catch (e) {}

    const values = parseValuesInput(rawVal);
    if (values && values.length > 0) {
      window.voteValues = values;
      socket.emit("vote/updateValues", {
        roomname: player.roomname,
        id: player.id,
        values: values,
      });
    }
  });

  $(document).on("click", ".start-activity-btn", function (e) {
    e.stopPropagation();
    const activity = $(this).data("activity");
    let questions = null;
    let values = null;

    if (activity === 'popquiz') {
      const rawVal = $("#popquiz-questions").val() || '';
      try {
        localStorage.setItem('popquiz_questions_draft', rawVal);
      } catch (e) {}

      const rawText = rawVal.trim();
      if (rawText) {
        questions = rawText.split('\n')
          .map(function(line) {
            return line.split(',').map(function(item) { return item.trim(); }).filter(Boolean);
          })
          .filter(function(arr) { return arr.length > 0; });
      }
      if (!questions || questions.length === 0) {
        questions = [
          ['apples', 'bananas', 'pears'],
          ['red', 'yellow', 'green', 'blue'],
        ];
      }
      window.popquizQuestions = questions;
    }

    if (activity === 'raffle') {
      const rawVal = $("#raffle-values").val() || '';
      try {
        localStorage.setItem('raffle_values_draft', rawVal);
      } catch (e) {}

      values = parseValuesInput(rawVal);
      if (!values || values.length === 0) {
        values = [
          'Grand Prize',
          'Gold Medal',
          'Silver Trophy',
          'Surprise Mystery Box',
          'Bonus Points x100',
          'Free Pass',
          'Super Sticker Pack',
          'High Five'
        ];
      }
      window.raffleValues = values;
    }

    if (activity === 'vote') {
      const rawVal = $("#vote-values").val() || '';
      try {
        localStorage.setItem('vote_values_draft', rawVal);
      } catch (e) {}

      values = parseValuesInput(rawVal);
      if (!values || values.length === 0) {
        values = [
          'Option A',
          'Option B',
          'Option C',
          'Option D',
          'Option E'
        ];
      }
      window.voteValues = values;
    }

    socket.emit("startActivity", {
      roomname: player.roomname,
      id: player.id,
      activity: activity,
      questions: questions,
      values: values,
      payload: values || questions,
    });
  });

// SOCKET EVENTS ///////////////////////////////////////////////////////////////
  socket.on('connect', function(){
    const stored_player = loadStoredPlayer();
    
    if (!stored_player || !stored_player.id) {
      getName().then(function() {
        socket.emit('join', player);
      });
    } else {
      player = stored_player;
      $("#myName").text(player.id).css('color', player.color);
      $("#myPawn").html(getPawn(player.color));
      socket.emit('join', player);
    }
  });


  socket.on('joined', function(data){
    if (!data || !data.room) {
      if (data && data.message) {
        $("#info").text(data.message);
        $("#foundplayers").html('<div class="text-danger fw-bold">' + escapeHtml(data.message) + '</div>');
      }
      return;
    }

    room = data.room;
    player.number = data.playerNum;
    player.roomname = room.roomname;
    player.roomtype = room.roomtype; // Make sure roomtype is updated
    localStorage.setItem('player', JSON.stringify(player));
    $("#room").text(player.roomname);
    $("#roomname").text(player.roomname);
    $("#activityRoomName").text(player.roomname);
    updatePlayerList(room.players);
    if (room.activity) {
      player.activity = room.activity;
      loadActivity(room.activity);
    } else {
      const myPlayerRecord = room.players ? room.players.find(p => p.id === player.id || p.number === player.number) : null;
      player.activity = (myPlayerRecord && myPlayerRecord.activity) ? myPlayerRecord.activity : null;
      exitActivityMode();
    }
    renderPublicRooms();
  });


  socket.on('setName', function(data){
    if (room && room.players) {
      const target = room.players.find(p => p.number == data.number);
      if (target) {
        if (room.hostId === target.id) {
          room.hostId = data.id;
        }
        target.id = data.id;
      }
    }
    if (data.number == player.number) {
      player.id = data.id;
      localStorage.setItem('player', JSON.stringify(player));
      $("#myName").text(data.id).css('color', player.color);
      const isHost = Boolean(room && room.hostId && player.id === room.hostId);
      if (isHost) {
        $("#hostBadge").removeClass("d-none");
        $("#getName").removeClass("d-none");
        if (currentActivity) {
          $("#activityHostBadge").removeClass("d-none");
        }
      } else {
        $("#hostBadge").addClass("d-none");
        $("#getName").addClass("d-none");
        $("#activityHostBadge").addClass("d-none");
      }
    }
    else {
      $("#name" + data.number).text(data.id);
    }
  });


  socket.on('roomSearch', function(data){
    $("#foundplayers").empty();

    if (data && String(data.roomname).toLowerCase() != String(player.roomname || '').toLowerCase()) {
      for (let i = 0; i < data.players.length; i++) {
        const p = data.players[i];
        const safeColor = sanitizeColor(p.color);
        const safeId = escapeHtml(p.id);
        $("#foundplayers").append('<div style="color: ' + safeColor + ';text-shadow:0px 0px 2px #000;">' + safeId + '</div>');
      }
      $("#join").prop('disabled', false);
    }
    else {
      $("#foundplayers").empty();
      if ($("#roomSearch").val().trim()) {
        $("#foundplayers").html('<div class="text-muted small">No group found</div>');
      }
      $("#join").prop('disabled', true);
    }
  });


  // other players' events /////////////////////////////////////////////////////
  socket.on('playerJoined', function(data){
    updatePlayerList(data);
  });
  
  socket.on('youLeft', function(data){
    exitActivityMode();

    room = {};
    player.roomname = null; // reset the roomname
    player.roomtype = "private"; // reset the roomtype
    player.number = 1; // reset the player number
    player.activity = null; // reset the activity
    
    // Clear UI elements
    $("#hostBadge").addClass("d-none");
    $("#activityRoomName").empty();
    $("#otherPlayers").empty();
    $(".activity").find(".pawn").remove();
    $("#foundplayers").empty();
    $("#roomSearch").val('');
    $("#join").prop('disabled', true);
    
    // Update localStorage and join new room
    localStorage.setItem('player', JSON.stringify(player));
    renderPublicRooms();
    socket.emit('join', player); // join a new private room
    socket.emit('getPublicRooms');
  });

  socket.on('roomExpired', function(data){
    exitActivityMode();

    room = {};
    player.roomname = null;
    player.roomtype = "private";
    player.number = 1;
    player.activity = null;

    $("#hostBadge").addClass("d-none");
    $("#activityRoomName").empty();
    $("#otherPlayers").empty();
    $(".activity").find(".pawn").remove();
    $("#foundplayers").empty();
    $("#roomSearch").val('');
    $("#join").prop('disabled', true);

    localStorage.setItem('player', JSON.stringify(player));
    renderPublicRooms();
    socket.emit('join', player);
    socket.emit('getPublicRooms');
  });

  socket.on('playerLeft', function(data){
    updatePlayerList(data);
  });

  socket.on('setColor', function(data){
    if (!data) return;
    if (room && room.players) {
      let foundPlayer = room.players.find(p => p.number === data.number || p.id === data.id);
      if (foundPlayer) {
        foundPlayer.color = data.color;
      }
    }
    
    // Update visual elements
    setColor(data.number, data.color);
  });

  socket.on('publicRoomsList', function(rooms){
    renderPublicRooms(rooms);
  });

  socket.on('roomOpened', function(data){
    player.roomtype = "public";
    localStorage.setItem('player', JSON.stringify(player));
    updatePlayerList(data);
  });

  socket.on('roomClosed', function(data){
    player.roomtype = "private";
    player.activity = null;
    localStorage.setItem('player', JSON.stringify(player));
    updatePlayerList(data);
    renderPublicRooms();
  });

  socket.on('activityChosen', function(data){
    updatePlayerList(data);
  });

  socket.on('loadActivity', function(data){
    const activity = (typeof data === 'object' && data) ? data.activity : data;
    if (typeof data === 'object' && data && data.questions) {
      window.popquizQuestions = data.questions;
    }
    if (typeof data === 'object' && data && data.values) {
      window.raffleValues = data.values;
      window.voteValues = data.values;
    }
    loadActivity(activity);
  });

  socket.on('returnToLobby', function(data){
    if (room) {
      room.activity = null;
      room.selectedHostActivity = null;
    }
    exitActivityMode();
    player.activity = null;
    localStorage.setItem('player', JSON.stringify(player));
    renderPublicRooms();

    if (data) {
      updatePlayerList(data);
    }
  });

});
