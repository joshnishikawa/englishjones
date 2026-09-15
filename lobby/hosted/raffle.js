/**
 * sockets/hosted/activities/raffle.js — Raffle hosted activity server socket handlers
 */

const curatedEmojis = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅',
  '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌',
  '🐞', '🐢', '🐍', '🐙', '🦑', '🦐', '🦀', '🐡', '🐠', '🐬',
  '🐳', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛',
  '🍎', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥑', '🍕',
  '🍔', '🍟', '🍦', '🍩', '🍪', '🎂', '🍿', '🚀', '⭐', '🌈',
  '🎈', '🎁', '🏆', '💎', '⚽', '🏀', '🎸', '🎨', '🎯', '🔥'
];

const { getSharedTotalCount, handleSetTotalCount, handleSelectNumber } = require('./shared');

const defaultValues = [
  'Grand Prize',
  'Gold Medal',
  'Silver Trophy',
  'Surprise Mystery Box',
  'Bonus Points x100',
  'Free Pass',
  'Super Sticker Pack',
  'High Five'
];

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getRandomEmojis(count) {
  const shuffled = shuffleArray(curatedEmojis);
  const result = [];
  while (result.length < count) {
    for (let i = 0; i < shuffled.length && result.length < count; i++) {
      result.push(shuffled[i]);
    }
  }
  return result.slice(0, count);
}

const raffleStates = new Map();

function getTotalCount(state) {
  const itemCount = state.values ? state.values.length : 0;
  return getSharedTotalCount(state, itemCount);
}

function getOrCreateRaffleState(roomname, initialValues, hostId) {
  if (!raffleStates.has(roomname)) {
    let values = [];
    if (Array.isArray(initialValues) && initialValues.length > 0) {
      values = initialValues.filter((v) => typeof v === 'string' && v.trim().length > 0);
    }
    if (values.length === 0) {
      values = [...defaultValues];
    }

    const shuffledValues = shuffleArray(values);
    const emojis = getRandomEmojis(values.length);

    raffleStates.set(roomname, {
      values,
      shuffledValues,
      emojis,
      stage: 'numbers', // 'numbers' | 'emojis' | 'revealed'
      hostId: hostId || null,
      customTotalCount: null,
      numberSelections: new Map(), // playerId -> number (1..N)
      emojiSelections: new Map(),  // playerId -> { emojiIndex, emoji }
      claimedEmojis: new Map(),    // emojiIndex -> playerId
      readySockets: new Set(),
      players: new Map(),
      started: false,
    });
  } else {
    const state = raffleStates.get(roomname);
    if (hostId) {
      state.hostId = hostId;
    }
  }
  return raffleStates.get(roomname);
}

function removeSocketFromRaffle(socketId, roomname) {
  const state = raffleStates.get(roomname);
  if (!state) return;
  state.readySockets.delete(socketId);
}

function clearRaffleState(roomname) {
  raffleStates.delete(roomname);
}

function serializeRaffleState(state) {
  const numberSelectionsObj = {};
  state.numberSelections.forEach((num, pId) => {
    numberSelectionsObj[pId] = num;
  });

  const claimedEmojisObj = {};
  state.claimedEmojis.forEach((pId, idx) => {
    claimedEmojisObj[idx] = pId;
  });

  const emojiSelectionsObj = {};
  state.emojiSelections.forEach((val, pId) => {
    emojiSelectionsObj[pId] = val;
  });

  const totalCount = getTotalCount(state);

  return {
    stage: state.stage,
    totalCount: totalCount,
    customTotalCount: state.customTotalCount || null,
    values: state.stage === 'revealed' ? state.shuffledValues : null,
    results: state.stage === 'revealed' ? buildResultsTable(state) : null,
    emojis: state.emojis,
    hostId: state.hostId,
    players: Array.from(state.players.values()),
    numberSelections: numberSelectionsObj,
    claimedEmojis: claimedEmojisObj,
    emojiSelections: emojiSelectionsObj,
    started: state.started,
  };
}

function buildResultsTable(state) {
  const playersList = Array.from(state.players.values()).filter((p) => p.id !== state.hostId);
  const targetPlayers = playersList.length > 0 ? playersList : Array.from(state.players.values());

  return targetPlayers.map((p) => {
    const chosenNumber = state.numberSelections.get(p.id) || null;
    const emojiData = state.emojiSelections.get(p.id) || null;
    const emojiIndex = emojiData ? emojiData.emojiIndex : null;
    const emoji = emojiData ? emojiData.emoji : null;
    const prize = (emojiIndex !== null && state.shuffledValues && state.shuffledValues[emojiIndex] !== undefined)
      ? state.shuffledValues[emojiIndex]
      : '—';

    return {
      playerId: p.id,
      playerNumber: p.number,
      color: p.color,
      selectedNumber: chosenNumber,
      selectedEmojiIndex: emojiIndex,
      selectedEmoji: emoji,
      revealedValue: prize,
    };
  });
}

const raffleEvents = (io, socket, touchRoom) => {
  socket.on('raffle/ready', function(data) {
    if (!data || !data.roomname) return;
    if (typeof touchRoom === 'function') touchRoom(data.roomname);

    socket.join(data.roomname);
    socket.data.raffleRoomname = data.roomname;

    const isHost = Boolean(data.isHost || (data.hostId && data.playerId === data.hostId));
    const state = getOrCreateRaffleState(
      data.roomname,
      isHost ? (data.values || data.questions) : null,
      data.hostId || (data.isHost ? data.playerId : null)
    );
    state.readySockets.add(socket.id);

    if (data.playerId) {
      state.players.set(data.playerId, {
        id: data.playerId,
        number: Number(data.playerNumber) || 1,
        color: data.color || '#0d6efd',
        socketId: socket.id,
      });
    }

    if (Array.isArray(data.roomPlayers)) {
      data.roomPlayers.forEach((p) => {
        if (p && p.id && !state.players.has(p.id)) {
          state.players.set(p.id, {
            id: p.id,
            number: Number(p.number) || 1,
            color: p.color || '#0d6efd',
          });
        }
      });
    }

    if (isHost && data.playerId) {
      state.hostId = data.playerId;
      state.started = true;
      if (Array.isArray(data.values) && data.values.length > 0 && state.stage === 'numbers') {
        const cleanValues = data.values.filter((v) => typeof v === 'string' && v.trim().length > 0);
        if (cleanValues.length > 0) {
          state.values = cleanValues;
          state.shuffledValues = shuffleArray(cleanValues);
          state.emojis = getRandomEmojis(Math.max(cleanValues.length, getTotalCount(state)));
        }
      }
    }

    const totalCount = getTotalCount(state);
    if (state.emojis.length < totalCount) {
      state.emojis = getRandomEmojis(totalCount);
    }

    io.to(data.roomname).emit('raffle/sync', serializeRaffleState(state));
  });

  socket.on('raffle/updateValues', function(data) {
    if (!data || !data.roomname) return;
    if (typeof touchRoom === 'function') touchRoom(data.roomname);
    const state = raffleStates.get(data.roomname);
    if (!state) return;

    if (state.hostId && data.id !== state.hostId) return;

    if (Array.isArray(data.values) && data.values.length > 0) {
      const cleanValues = data.values.filter((v) => typeof v === 'string' && v.trim().length > 0);
      if (cleanValues.length > 0) {
        state.values = cleanValues;
        state.shuffledValues = shuffleArray(cleanValues);
        const totalCount = getTotalCount(state);
        state.emojis = getRandomEmojis(totalCount);
        io.to(data.roomname).emit('raffle/sync', serializeRaffleState(state));
      }
    }
  });

  socket.on('raffle/selectNumber', function(data) {
    const state = raffleStates.get(data && data.roomname);
    handleSelectNumber(state, data, socket, io, 'raffle', (s) => (s.values ? s.values.length : 0), touchRoom);
  });

  socket.on('raffle/setTotalCount', function(data) {
    const state = raffleStates.get(data && data.roomname);
    handleSetTotalCount(state, data, socket, io, 'raffle', serializeRaffleState, touchRoom);
  });

  socket.on('raffle/setNumbers', function(data) {
    if (!data || !data.roomname) return;
    if (typeof touchRoom === 'function') touchRoom(data.roomname);
    const state = raffleStates.get(data.roomname);
    if (!state || state.stage !== 'numbers') return;

    if (state.hostId && data.id !== state.hostId) {
      socket.emit('error', { message: 'Only the host can set numbers.' });
      return;
    }

    const totalCount = getTotalCount(state);
    if (state.emojis.length < totalCount) {
      state.emojis = getRandomEmojis(totalCount);
    }

    state.stage = 'emojis';
    io.to(data.roomname).emit('raffle/stageChanged', {
      stage: 'emojis',
      emojis: state.emojis,
      totalCount: totalCount,
      numberSelections: Object.fromEntries(state.numberSelections),
    });
  });

  socket.on('raffle/selectEmoji', function(data) {
    if (!data || !data.roomname || !data.playerId) return;
    if (typeof touchRoom === 'function') touchRoom(data.roomname);
    const state = raffleStates.get(data.roomname);
    if (!state || state.stage !== 'emojis') return;
    if (state.hostId && data.playerId === state.hostId) return;

    const emojiIdx = parseInt(data.emojiIndex, 10);
    if (isNaN(emojiIdx) || emojiIdx < 0 || emojiIdx >= state.emojis.length) return;

    // Rule: Once selected, cannot change
    if (state.emojiSelections.has(data.playerId)) {
      socket.emit('error', { message: 'You have already selected an emoji.' });
      return;
    }

    // Rule: No one else can select the same emoji
    if (state.claimedEmojis.has(emojiIdx)) {
      socket.emit('error', { message: 'This emoji has already been chosen by another player.' });
      return;
    }

    const selectedEmoji = state.emojis[emojiIdx];
    state.claimedEmojis.set(emojiIdx, data.playerId);
    state.emojiSelections.set(data.playerId, {
      emojiIndex: emojiIdx,
      emoji: selectedEmoji,
    });

    const playerObj = state.players.get(data.playerId) || {
      id: data.playerId,
      number: data.playerNumber || 1,
      color: data.color || '#0d6efd',
    };

    io.to(data.roomname).emit('raffle/emojiSelected', {
      playerId: data.playerId,
      player: playerObj,
      emojiIndex: emojiIdx,
      emoji: selectedEmoji,
    });
  });

  socket.on('raffle/reveal', function(data) {
    if (!data || !data.roomname) return;
    if (typeof touchRoom === 'function') touchRoom(data.roomname);
    const state = raffleStates.get(data.roomname);
    if (!state || state.stage !== 'emojis') return;

    if (state.hostId && data.id !== state.hostId) {
      socket.emit('error', { message: 'Only the host can reveal values.' });
      return;
    }

    state.stage = 'revealed';
    const results = buildResultsTable(state);

    io.to(data.roomname).emit('raffle/revealed', {
      shuffledValues: state.shuffledValues,
      results: results,
      emojis: state.emojis,
      claimedEmojis: Object.fromEntries(state.claimedEmojis),
    });
  });

  socket.on('disconnect', function() {
    if (!socket.data.raffleRoomname) return;
    removeSocketFromRaffle(socket.id, socket.data.raffleRoomname);
  });
};

function handlePlayerLeft(roomname, playerId, newHostId) {
  const state = raffleStates.get(roomname);
  if (!state) return;
  state.players.delete(playerId);
  if (newHostId) {
    state.hostId = newHostId;
  }
  // Keep numberSelections, emojiSelections, claimedEmojis intact for rejoin!
}

function updateHostId(roomname, oldHostId, newHostId) {
  const state = raffleStates.get(roomname);
  if (!state) return;
  if (state.hostId === oldHostId) {
    state.hostId = newHostId;
  }
  if (state.players.has(oldHostId)) {
    const hostPlayer = state.players.get(oldHostId);
    state.players.delete(oldHostId);
    hostPlayer.id = newHostId;
    state.players.set(newHostId, hostPlayer);
  }
  if (state.numberSelections.has(oldHostId)) {
    const num = state.numberSelections.get(oldHostId);
    state.numberSelections.delete(oldHostId);
    state.numberSelections.set(newHostId, num);
  }
}

raffleEvents.getOrCreateRaffleState = getOrCreateRaffleState;
raffleEvents.clearRaffleState = clearRaffleState;
raffleEvents.getTotalCount = getTotalCount;
raffleEvents.handlePlayerLeft = handlePlayerLeft;
raffleEvents.updateHostId = updateHostId;

module.exports = raffleEvents;

