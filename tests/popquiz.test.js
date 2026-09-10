const popquizEvents = require('../lobby/hosted/popquiz');

describe('Pop Quiz Hosted Activity Socket Handlers', () => {
  let ioMock;
  let socketHost;
  let socketGuest1;
  let socketGuest2;
  const roomname = 'test-popquiz-room';

  beforeEach(() => {
    popquizEvents.clearPopquizState(roomname);

    ioMock = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    function createMockSocket(id) {
      const handlers = {};
      const s = {
        id,
        data: {},
        join: jest.fn(),
        emit: jest.fn(),
        on: jest.fn((event, handler) => {
          handlers[event] = handler;
        }),
        trigger: (event, data) => {
          if (handlers[event]) handlers[event](data);
        },
      };
      return s;
    }

    socketHost = createMockSocket('socket-host');
    socketGuest1 = createMockSocket('socket-guest-1');
    socketGuest2 = createMockSocket('socket-guest-2');

    const touchRoom = jest.fn();
    popquizEvents(ioMock, socketHost, touchRoom);
    popquizEvents(ioMock, socketGuest1, touchRoom);
    popquizEvents(ioMock, socketGuest2, touchRoom);
  });

  test('initializes state on popquiz/ready and sends initial numbers stage sync', () => {
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'HostTeacher',
      playerNumber: 1,
      color: '#ff0000',
      isHost: true,
      questions: [
        ['apples', 'bananas'],
        ['red', 'blue'],
      ],
    });

    expect(ioMock.to).toHaveBeenCalledWith(roomname);
    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/sync', expect.objectContaining({
      stage: 'numbers',
      totalCount: 2,
      hostId: 'HostTeacher',
    }));
  });

  test('calculates totalCount as max(userCount, itemCount)', () => {
    // 2 questions but 4 student players
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'HostTeacher',
      playerNumber: 1,
      color: '#ff0000',
      isHost: true,
      questions: [
        ['cat', 'dog'],
        ['sun', 'moon'],
      ],
      roomPlayers: [
        { id: 'HostTeacher', number: 1 },
        { id: 'Student1', number: 2 },
        { id: 'Student2', number: 3 },
        { id: 'Student3', number: 4 },
        { id: 'Student4', number: 5 },
      ],
    });

    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/sync', expect.objectContaining({
      stage: 'numbers',
      totalCount: 4,
    }));
  });

  test('allows guests to select numbers in Phase 1', () => {
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      questions: [
        ['one', 'two'],
        ['three', 'four'],
      ],
    });

    socketGuest1.trigger('popquiz/selectNumber', {
      roomname,
      playerId: 'Student1',
      number: 2,
    });

    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/numberSelected', {
      playerId: 'Student1',
      number: 2,
    });
  });

  test('host advances from Phase 1 to Phase 2 (quiz) with popquiz/setNumbers', () => {
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      questions: [
        ['apples', 'bananas', 'pears'],
      ],
    });

    socketGuest1.trigger('popquiz/ready', {
      roomname,
      playerId: 'Student1',
      playerNumber: 2,
      isHost: false,
    });

    socketGuest1.trigger('popquiz/selectNumber', {
      roomname,
      playerId: 'Student1',
      number: 1,
    });

    socketHost.trigger('popquiz/setNumbers', {
      roomname,
      id: 'HostTeacher',
    });

    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/roundstart', expect.objectContaining({
      choices: ['apples', 'bananas', 'pears'],
      questionIndex: 0,
      totalQuestions: 1,
    }));
  });

  test('non-host cannot advance to quiz rounds', () => {
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      questions: [['a', 'b']],
    });

    socketGuest1.trigger('popquiz/setNumbers', {
      roomname,
      id: 'Student1',
    });

    expect(socketGuest1.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      message: expect.stringContaining('Only the host'),
    }));
  });

  test('full quiz flow: select answer, host grade, advance question and gameover via popquiz/nextRound', () => {
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      questions: [
        ['a', 'b'],
        ['c', 'd'],
      ],
    });

    socketGuest1.trigger('popquiz/ready', {
      roomname,
      playerId: 'Student1',
      playerNumber: 2,
      color: '#00ff00',
      isHost: false,
    });

    socketHost.trigger('popquiz/setNumbers', {
      roomname,
      id: 'HostTeacher',
    });

    // Student selects choice 0 ('a')
    socketGuest1.trigger('popquiz/select', {
      roomname,
      playerId: 'Student1',
      playerNumber: 2,
      color: '#00ff00',
      choiceIndex: 0,
    });

    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/playerselected', {
      playerId: 'Student1',
      playerNumber: 2,
      color: '#00ff00',
      choiceIndex: 0,
    });

    // Host grades answer
    socketHost.trigger('popquiz/grade', {
      roomname,
      id: 'HostTeacher',
      correctChoiceIndex: 0,
    });

    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/graded', expect.objectContaining({
      correctChoiceIndex: 0,
      scores: expect.objectContaining({ Student1: 1 }),
      isGameOver: false,
    }));

    // Verify state did not automatically advance
    const state = popquizEvents.getOrCreatePopquizState(roomname);
    expect(state.currentQuestionIndex).toBe(0);
    expect(state.graded).toBe(true);

    // Host manually advances to question 2
    socketHost.trigger('popquiz/nextRound', {
      roomname,
      id: 'HostTeacher',
    });

    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/roundstart', expect.objectContaining({
      choices: ['c', 'd'],
      questionIndex: 1,
      totalQuestions: 2,
    }));

    // Host grades question 2
    socketHost.trigger('popquiz/grade', {
      roomname,
      id: 'HostTeacher',
      correctChoiceIndex: 1,
    });

    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/graded', expect.objectContaining({
      correctChoiceIndex: 1,
      isGameOver: true,
    }));

    // Host manually finishes quiz
    socketHost.trigger('popquiz/nextRound', {
      roomname,
      id: 'HostTeacher',
    });

    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/gameover', expect.objectContaining({
      scores: expect.objectContaining({ Student1: 1 }),
    }));
  });

  test('host can directly edit totalCount in numbers stage via popquiz/setTotalCount', () => {
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      questions: [['a', 'b']],
    });

    socketGuest1.trigger('popquiz/selectNumber', {
      roomname,
      playerId: 'Student1',
      number: 5,
    });

    // Host updates totalCount to 3
    socketHost.trigger('popquiz/setTotalCount', {
      roomname,
      id: 'HostTeacher',
      totalCount: 3,
    });

    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/sync', expect.objectContaining({
      stage: 'numbers',
      totalCount: 3,
      customTotalCount: 3,
    }));

    // Guest selection of 5 should have been pruned since totalCount is 3
    const state = popquizEvents.getOrCreatePopquizState(roomname);
    expect(state.numberSelections.has('Student1')).toBe(false);
  });

  test('non-host cannot edit item count', () => {
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      questions: [['a', 'b']],
    });

    socketGuest1.trigger('popquiz/setTotalCount', {
      roomname,
      id: 'Student1',
      totalCount: 10,
    });

    expect(socketGuest1.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      message: expect.stringContaining('Only the host'),
    }));
  });

  test('rejoining guest with different questions does not overwrite host questions', () => {
    // Host readies with host questions
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'HostTeacher',
      playerNumber: 1,
      isHost: true,
      questions: [
        ['host_q1_choice1', 'host_q1_choice2'],
        ['host_q2_choice1', 'host_q2_choice2'],
      ],
    });

    // Guest readies with guest's local storage questions
    socketGuest1.trigger('popquiz/ready', {
      roomname,
      playerId: 'GuestStudent',
      playerNumber: 2,
      isHost: false,
      questions: [
        ['guest_rogue_q1', 'guest_rogue_q2'],
      ],
    });

    // The state questions must remain the host questions
    const state = popquizEvents.getOrCreatePopquizState(roomname);
    expect(state.questions).toEqual([
      ['host_q1_choice1', 'host_q1_choice2'],
      ['host_q2_choice1', 'host_q2_choice2'],
    ]);

    // The broadcast sync must have the host choices
    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/sync', expect.objectContaining({
      choices: ['host_q1_choice1', 'host_q1_choice2'],
      totalQuestions: 2,
    }));
  });

  test('re-emitting popquiz/ready after grading sends popquiz/graded with correct answer to reconnecting socket', () => {
    // 1. Host readies and starts quiz
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'HostTeacher',
      playerNumber: 1,
      isHost: true,
      questions: [
        ['cat', 'dog'],
        ['sun', 'moon'],
      ],
    });
    socketGuest1.trigger('popquiz/ready', {
      roomname,
      playerId: 'Student1',
      playerNumber: 2,
      isHost: false,
    });

    socketHost.trigger('popquiz/setNumbers', {
      roomname,
      id: 'HostTeacher',
    });

    // 2. Student selects choice 1 ('dog')
    socketGuest1.trigger('popquiz/select', {
      roomname,
      playerId: 'Student1',
      choiceIndex: 1,
    });

    // 3. Host grades choice 1 as correct
    socketHost.trigger('popquiz/grade', {
      roomname,
      id: 'HostTeacher',
      correctChoiceIndex: 1,
    });

    expect(ioMock.emit).toHaveBeenCalledWith('popquiz/graded', expect.objectContaining({
      correctChoiceIndex: 1,
      scores: expect.objectContaining({ Student1: 1 }),
    }));

    // 4. Host simulates page refresh: emits popquiz/ready on a new socket instance
    const socketHostRefreshed = {
      id: 'socket-host-refreshed',
      data: {},
      join: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
    };
    popquizEvents(ioMock, socketHostRefreshed, jest.fn());

    const refreshHandlers = {};
    socketHostRefreshed.on.mock.calls.forEach(([evt, handler]) => {
      refreshHandlers[evt] = handler;
    });

    refreshHandlers['popquiz/ready']({
      roomname,
      playerId: 'HostTeacher',
      playerNumber: 1,
      isHost: true,
    });

    // Verify socket received roundstart, playerselected, AND graded
    expect(socketHostRefreshed.emit).toHaveBeenCalledWith('popquiz/roundstart', expect.objectContaining({
      questionIndex: 0,
      choices: ['cat', 'dog'],
    }));

    expect(socketHostRefreshed.emit).toHaveBeenCalledWith('popquiz/playerselected', expect.objectContaining({
      playerId: 'Student1',
      choiceIndex: 1,
    }));

    expect(socketHostRefreshed.emit).toHaveBeenCalledWith('popquiz/graded', expect.objectContaining({
      correctChoiceIndex: 1,
      scores: expect.objectContaining({ Student1: 1 }),
      isGameOver: false,
    }));
  });

  test('handlePlayerLeft removes player from active players while keeping score and selections intact for rejoin', () => {
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'HostTeacher',
      playerNumber: 1,
      isHost: true,
      questions: [['a', 'b'], ['c', 'd']],
    });
    socketGuest1.trigger('popquiz/ready', {
      roomname,
      playerId: 'Student1',
      playerNumber: 2,
      isHost: false,
    });
    socketGuest1.trigger('popquiz/selectNumber', {
      roomname,
      playerId: 'Student1',
      number: 2,
    });

    const state = popquizEvents.getOrCreatePopquizState(roomname);
    state.scores['Student1'] = 3;
    expect(state.players.has('Student1')).toBe(true);
    expect(state.numberSelections.get('Student1')).toBe(2);

    // Player leaves
    popquizEvents.handlePlayerLeft(roomname, 'Student1');
    expect(state.players.has('Student1')).toBe(false);
    expect(state.scores['Student1']).toBe(3);
    expect(state.numberSelections.get('Student1')).toBe(2);

    // Player rejoins
    socketGuest1.trigger('popquiz/ready', {
      roomname,
      playerId: 'Student1',
      playerNumber: 2,
      isHost: false,
    });
    expect(state.players.has('Student1')).toBe(true);
    expect(state.scores['Student1']).toBe(3);
    expect(state.numberSelections.get('Student1')).toBe(2);
  });

  test('updateHostId updates hostId and host player map entry when host changes name', () => {
    socketHost.trigger('popquiz/ready', {
      roomname,
      playerId: 'OldHost',
      playerNumber: 1,
      isHost: true,
      questions: [['a', 'b']],
    });

    const state = popquizEvents.getOrCreatePopquizState(roomname);
    expect(state.hostId).toBe('OldHost');
    expect(state.players.has('OldHost')).toBe(true);

    popquizEvents.updateHostId(roomname, 'OldHost', 'NewHost');
    expect(state.hostId).toBe('NewHost');
    expect(state.players.has('OldHost')).toBe(false);
    expect(state.players.has('NewHost')).toBe(true);
  });
});



