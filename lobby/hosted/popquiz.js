/**
 * sockets/hosted/activities/popquiz.js — Pop Quiz hosted activity server socket handlers
 */
const { getSharedTotalCount, handleSetTotalCount, handleSelectNumber } = require('./shared');

const defaultQuestions = [
  ['apples', 'bananas', 'pears'],
  ['red', 'yellow', 'green', 'blue'],
];

const popquizStates = new Map();

function getTotalCount(state) {
  const itemCount = state.questions ? state.questions.length : 0;
  return getSharedTotalCount(state, itemCount);
}

function getOrCreatePopquizState(roomname, initialQuestions, hostId) {
  if (!popquizStates.has(roomname)) {
    const questions = Array.isArray(initialQuestions) && initialQuestions.length > 0
      ? initialQuestions
      : defaultQuestions.map((arr) => [...arr]);

    popquizStates.set(roomname, {
      questions,
      currentQuestionIndex: 0,
      stage: 'numbers', // 'numbers' | 'quiz' | 'gameover'
      hostId: hostId || null,
      scores: {},
      numberSelections: new Map(), // playerId -> number (1..totalCount)
      selections: new Map(),        // playerId -> choiceIndex
      readySockets: new Set(),
      players: new Map(),
      graded: false,
      started: false,
      customTotalCount: null,
      correctChoiceIndex: null,
      lastGradedData: null,
    });
  } else {
    const state = popquizStates.get(roomname);
    if (hostId) {
      state.hostId = hostId;
    }
  }
  return popquizStates.get(roomname);
}

function removeSocketFromPopquiz(socketId, roomname) {
  const state = popquizStates.get(roomname);
  if (!state) return;

  state.readySockets.delete(socketId);
}

function clearPopquizState(roomname) {
  popquizStates.delete(roomname);
}

function serializePopquizState(state) {
  const numberSelectionsObj = {};
  state.numberSelections.forEach((num, pId) => {
    numberSelectionsObj[pId] = num;
  });

  const totalCount = getTotalCount(state);
  const currentChoices = state.questions[state.currentQuestionIndex] || [];

  return {
    stage: state.stage,
    totalCount: totalCount,
    customTotalCount: state.customTotalCount || null,
    questionIndex: state.currentQuestionIndex,
    totalQuestions: state.questions.length,
    choices: currentChoices,
    hostId: state.hostId,
    players: Array.from(state.players.values()),
    numberSelections: numberSelectionsObj,
    scores: state.scores,
    started: state.started,
    graded: state.graded || false,
    correctChoiceIndex: state.correctChoiceIndex !== undefined ? state.correctChoiceIndex : null,
    isGameOver: state.isGameOver || false,
    gameOverData: state.gameOverData || null,
  };
}

function emitRoundStart(io, roomname, state) {
  state.stage = 'quiz';
  state.started = true;
  state.graded = false;
  state.correctChoiceIndex = null;
  state.lastGradedData = null;
  state.lastRoundStart = Date.now();
  state.selections.clear();

  const currentChoices = state.questions[state.currentQuestionIndex] || [];
  const playersList = Array.from(state.players.values());

  io.to(roomname).emit('popquiz/roundstart', {
    questionIndex: state.currentQuestionIndex,
    totalQuestions: state.questions.length,
    choices: currentChoices,
    scores: state.scores,
    players: playersList,
    hostId: state.hostId,
  });
}

const popquizEvents = (io, socket, touchRoom) => {
  socket.on('popquiz/ready', function(data) {
    if (!data || !data.roomname) return;
    if (typeof touchRoom === 'function') touchRoom(data.roomname);

    socket.join(data.roomname);
    socket.data.popquizRoomname = data.roomname;

    const isHost = Boolean(data.isHost || (data.hostId && data.playerId === data.hostId));
    const state = getOrCreatePopquizState(
      data.roomname,
      isHost ? data.questions : null,
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
      if (state.scores[data.playerId] === undefined) {
        state.scores[data.playerId] = 0;
      }
    }

    if (Array.isArray(data.roomPlayers)) {
      data.roomPlayers.forEach((p) => {
        if (p && p.id && !state.players.has(p.id)) {
          state.players.set(p.id, {
            id: p.id,
            number: Number(p.number) || 1,
            color: p.color || '#0d6efd',
          });
          if (state.scores[p.id] === undefined) {
            state.scores[p.id] = 0;
          }
        }
      });
    }

    if (isHost && data.playerId) {
      state.hostId = data.playerId;
      if (Array.isArray(data.questions) && data.questions.length > 0 && !state.started) {
        state.questions = data.questions;
      }
    }

    const serialized = serializePopquizState(state);

    // Broadcast synchronization to all clients in the room
    io.to(data.roomname).emit('popquiz/sync', serialized);
    io.to(data.roomname).emit('popquiz/playersync', {
      players: serialized.players,
      scores: state.scores,
      hostId: state.hostId,
    });

    if (state.isGameOver && state.gameOverData) {
      socket.emit('popquiz/gameover', state.gameOverData);
    } else if (state.stage === 'quiz' && state.started) {
      const currentChoices = state.questions[state.currentQuestionIndex] || [];
      socket.emit('popquiz/roundstart', {
        questionIndex: state.currentQuestionIndex,
        totalQuestions: state.questions.length,
        choices: currentChoices,
        scores: state.scores,
        players: serialized.players,
        hostId: state.hostId,
      });

      state.selections.forEach((choiceIndex, pId) => {
        const playerObj = state.players.get(pId);
        if (playerObj) {
          socket.emit('popquiz/playerselected', {
            playerId: pId,
            playerNumber: playerObj.number,
            color: playerObj.color,
            choiceIndex: choiceIndex,
          });
        }
      });

      if (state.graded) {
        if (!state.lastGradedData && state.correctChoiceIndex !== null && state.correctChoiceIndex !== undefined) {
          const playersArray = Array.from(state.players.values());
          const studentPlayers = playersArray.filter((p) => p.id !== state.hostId);
          const targetPlayers = studentPlayers.length > 0 ? studentPlayers : playersArray;
          const results = targetPlayers.map((p) => {
            const selectedIndex = state.selections.has(p.id) ? state.selections.get(p.id) : null;
            return {
              playerId: p.id,
              playerNumber: p.number,
              color: p.color,
              choiceIndex: selectedIndex,
              correct: selectedIndex === state.correctChoiceIndex,
              score: state.scores[p.id] || 0,
            };
          });
          state.lastGradedData = {
            correctChoiceIndex: state.correctChoiceIndex,
            results,
            scores: state.scores,
            isGameOver: state.currentQuestionIndex + 1 >= state.questions.length,
          };
        }
        if (state.lastGradedData) {
          socket.emit('popquiz/graded', state.lastGradedData);
        }
      }
    }
  });

  socket.on('popquiz/selectNumber', function(data) {
    const state = popquizStates.get(data && data.roomname);
    handleSelectNumber(state, data, socket, io, 'popquiz', (s) => (s.questions ? s.questions.length : 0), touchRoom);
  });

  socket.on('popquiz/setTotalCount', function(data) {
    const state = popquizStates.get(data && data.roomname);
    handleSetTotalCount(state, data, socket, io, 'popquiz', serializePopquizState, touchRoom);
  });

  socket.on('popquiz/setNumbers', function(data) {
    if (!data || !data.roomname) return;
    if (typeof touchRoom === 'function') touchRoom(data.roomname);
    const state = popquizStates.get(data.roomname);
    if (!state || state.stage !== 'numbers') return;

    if (state.hostId && data.id !== state.hostId) {
      socket.emit('error', { message: 'Only the host can start the quiz.' });
      return;
    }

    state.stage = 'quiz';
    state.started = true;
    emitRoundStart(io, data.roomname, state);
  });

  socket.on('popquiz/updateQuestions', function(data) {
    if (!data || !data.roomname) return;
    if (typeof touchRoom === 'function') touchRoom(data.roomname);
    const state = popquizStates.get(data.roomname);
    if (!state) return;

    if (state.hostId && data.id !== state.hostId) return;

    if (Array.isArray(data.questions) && data.questions.length > 0) {
      state.questions = data.questions;
      if (state.started && state.stage === 'quiz' && !state.isGameOver) {
        const currentChoices = state.questions[state.currentQuestionIndex] || [];
        io.to(data.roomname).emit('popquiz/roundstart', {
          questionIndex: state.currentQuestionIndex,
          totalQuestions: state.questions.length,
          choices: currentChoices,
          scores: state.scores,
          players: Array.from(state.players.values()),
          hostId: state.hostId,
        });
      } else if (state.stage === 'numbers') {
        io.to(data.roomname).emit('popquiz/sync', serializePopquizState(state));
      }
    }
  });

  socket.on('popquiz/select', function(data) {
    if (!data || !data.roomname) return;
    if (typeof touchRoom === 'function') touchRoom(data.roomname);
    const state = popquizStates.get(data.roomname);
    if (!state || state.stage !== 'quiz' || state.graded || state.isGameOver) return;

    state.selections.set(data.playerId, data.choiceIndex);

    io.to(data.roomname).emit('popquiz/playerselected', {
      playerId: data.playerId,
      playerNumber: data.playerNumber,
      color: data.color,
      choiceIndex: data.choiceIndex,
    });
  });

  socket.on('popquiz/grade', function(data) {
    if (!data || !data.roomname) return;
    if (typeof touchRoom === 'function') touchRoom(data.roomname);
    const state = popquizStates.get(data.roomname);
    if (!state || state.stage !== 'quiz' || state.graded || state.isGameOver) return;

    if (state.hostId && data.id !== state.hostId) {
      socket.emit('error', { message: 'Only the host can grade answers.' });
      return;
    }

    state.graded = true;
    const correctIndex = Number(data.correctChoiceIndex);
    state.correctChoiceIndex = correctIndex;

    const playersArray = Array.from(state.players.values());
    const studentPlayers = playersArray.filter((p) => p.id !== state.hostId);
    const targetPlayers = studentPlayers.length > 0 ? studentPlayers : playersArray;

    const results = targetPlayers.map((p) => {
      const selectedIndex = state.selections.has(p.id) ? state.selections.get(p.id) : null;
      const isCorrect = selectedIndex === correctIndex;
      if (isCorrect) {
        state.scores[p.id] = (state.scores[p.id] || 0) + 1;
      }
      return {
        playerId: p.id,
        playerNumber: p.number,
        color: p.color,
        choiceIndex: selectedIndex,
        correct: isCorrect,
        score: state.scores[p.id] || 0,
      };
    });

    const isGameOver = state.currentQuestionIndex + 1 >= state.questions.length;

    state.lastGradedData = {
      correctChoiceIndex: correctIndex,
      results,
      scores: state.scores,
      isGameOver,
    };

    io.to(data.roomname).emit('popquiz/graded', state.lastGradedData);
  });

  socket.on('popquiz/nextRound', function(data) {
    if (!data || !data.roomname) return;
    if (typeof touchRoom === 'function') touchRoom(data.roomname);
    const state = popquizStates.get(data.roomname);
    if (!state || state.stage !== 'quiz' || !state.graded || state.isGameOver) return;

    if (state.hostId && data.id !== state.hostId) {
      socket.emit('error', { message: 'Only the host can advance rounds.' });
      return;
    }

    const playersArray = Array.from(state.players.values());
    const studentPlayers = playersArray.filter((p) => p.id !== state.hostId);
    const targetPlayers = studentPlayers.length > 0 ? studentPlayers : playersArray;

    const isGameOver = state.currentQuestionIndex + 1 >= state.questions.length;

    if (isGameOver) {
      state.stage = 'gameover';
      state.isGameOver = true;
      const scoresArr = targetPlayers.map((p) => ({
        playerId: p.id,
        score: state.scores[p.id] || 0,
        player: p,
      }));

      scoresArr.sort((a, b) => b.score - a.score);
      const topScore = scoresArr.length > 0 ? scoresArr[0].score : 0;
      const winners = scoresArr.filter((s) => s.score === topScore && topScore > 0);

      state.gameOverData = {
        winners: winners.length > 0 ? winners : scoresArr,
        leaderboard: scoresArr,
        scores: state.scores,
      };

      io.to(data.roomname).emit('popquiz/gameover', state.gameOverData);
    } else {
      state.currentQuestionIndex += 1;
      state.correctChoiceIndex = null;
      state.lastGradedData = null;
      emitRoundStart(io, data.roomname, state);
    }
  });

  socket.on('disconnect', function() {
    if (!socket.data.popquizRoomname) return;
    removeSocketFromPopquiz(socket.id, socket.data.popquizRoomname);
  });
};

function handlePlayerLeft(roomname, playerId, newHostId) {
  const state = popquizStates.get(roomname);
  if (!state) return;
  state.players.delete(playerId);
  if (newHostId) {
    state.hostId = newHostId;
  }
  // Keep state.scores, state.numberSelections, state.selections intact for rejoin!
}

function updateHostId(roomname, oldHostId, newHostId) {
  const state = popquizStates.get(roomname);
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
  if (state.scores[oldHostId] !== undefined) {
    state.scores[newHostId] = state.scores[oldHostId];
    delete state.scores[oldHostId];
  }
  if (state.numberSelections.has(oldHostId)) {
    const num = state.numberSelections.get(oldHostId);
    state.numberSelections.delete(oldHostId);
    state.numberSelections.set(newHostId, num);
  }
}

popquizEvents.getOrCreatePopquizState = getOrCreatePopquizState;
popquizEvents.clearPopquizState = clearPopquizState;
popquizEvents.getTotalCount = getTotalCount;
popquizEvents.handlePlayerLeft = handlePlayerLeft;
popquizEvents.updateHostId = updateHostId;

module.exports = popquizEvents;

