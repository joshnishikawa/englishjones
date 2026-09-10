const voteEvents = require('../lobby/hosted/vote');

describe('Vote Hosted Activity Socket Handlers', () => {
  let ioMock;
  let socketHost;
  let socketGuest1;
  let socketGuest2;
  const roomname = 'test-vote-room';

  beforeEach(() => {
    voteEvents.clearVoteState(roomname);

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
    voteEvents(ioMock, socketHost, touchRoom);
    voteEvents(ioMock, socketGuest1, touchRoom);
    voteEvents(ioMock, socketGuest2, touchRoom);
  });

  test('initializes state on vote/ready and sends initial numbers stage sync', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      playerNumber: 1,
      color: '#ff0000',
      isHost: true,
      values: ['Topic 1', 'Topic 2', 'Topic 3', 'Topic 4'],
    });

    expect(ioMock.to).toHaveBeenCalledWith(roomname);
    expect(ioMock.emit).toHaveBeenCalledWith('vote/sync', expect.objectContaining({
      stage: 'numbers',
      totalCount: 4,
      hostId: 'HostTeacher',
      values: ['Topic 1', 'Topic 2', 'Topic 3', 'Topic 4'],
    }));
  });

  test('calculates totalCount as max(userCount, itemCount)', () => {
    // 2 voting options but 5 student players
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      playerNumber: 1,
      color: '#ff0000',
      isHost: true,
      values: ['Option 1', 'Option 2'],
      roomPlayers: [
        { id: 'HostTeacher', number: 1 },
        { id: 'Student1', number: 2 },
        { id: 'Student2', number: 3 },
        { id: 'Student3', number: 4 },
        { id: 'Student4', number: 5 },
        { id: 'Student5', number: 6 },
      ],
    });

    expect(ioMock.emit).toHaveBeenCalledWith('vote/sync', expect.objectContaining({
      stage: 'numbers',
      totalCount: 5,
    }));
  });

  test('allows guests to select numbers in Phase 1', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      values: ['Option A', 'Option B', 'Option C'],
    });

    socketGuest1.trigger('vote/selectNumber', {
      roomname,
      playerId: 'Student1',
      number: 2,
    });

    expect(ioMock.emit).toHaveBeenCalledWith('vote/numberSelected', {
      playerId: 'Student1',
      number: 2,
    });
  });

  test('host advances to Phase 2 (voting) with vote/setNumbers', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      values: ['Option A', 'Option B', 'Option C'],
    });

    socketGuest1.trigger('vote/selectNumber', {
      roomname,
      playerId: 'Student1',
      number: 1,
    });

    socketHost.trigger('vote/setNumbers', {
      roomname,
      id: 'HostTeacher',
    });

    expect(ioMock.emit).toHaveBeenCalledWith('vote/stageChanged', expect.objectContaining({
      stage: 'voting',
      totalCount: 3,
      values: ['Option A', 'Option B', 'Option C'],
      numberSelections: expect.objectContaining({ Student1: 1 }),
    }));
  });

  test('non-host cannot advance to voting stage', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      values: ['Option A', 'Option B'],
    });

    socketGuest1.trigger('vote/setNumbers', {
      roomname,
      id: 'Student1',
    });

    expect(socketGuest1.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      message: expect.stringContaining('Only the host'),
    }));
  });

  test('guests can allocate up to 5 stars across items and return stars to reserve', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      values: ['Pizza', 'Tacos', 'Burgers', 'Sushi', 'Salad'],
    });

    socketHost.trigger('vote/setNumbers', {
      roomname,
      id: 'HostTeacher',
    });

    // Student 1 votes: 3 stars on Pizza (idx 0) and 2 stars on Burgers (idx 2)
    socketGuest1.trigger('vote/setPlayerVotes', {
      roomname,
      playerId: 'Student1',
      votes: { 0: 3, 2: 2 },
    });

    expect(ioMock.emit).toHaveBeenCalledWith('vote/votesUpdated', expect.objectContaining({
      playerId: 'Student1',
      totals: [3, 0, 2, 0, 0],
      userVotes: expect.objectContaining({
        Student1: { 0: 3, 2: 2 },
      }),
    }));

    // Student 2 votes: 1 star each on 5 different items
    socketGuest2.trigger('vote/setPlayerVotes', {
      roomname,
      playerId: 'Student2',
      votes: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 },
    });

    expect(ioMock.emit).toHaveBeenCalledWith('vote/votesUpdated', expect.objectContaining({
      playerId: 'Student2',
      totals: [4, 1, 3, 1, 1],
    }));

    // Student 1 changes mind: removes 1 star from Pizza (now 2) and moves it to Sushi (idx 3)
    socketGuest1.trigger('vote/setPlayerVotes', {
      roomname,
      playerId: 'Student1',
      votes: { 0: 2, 2: 2, 3: 1 },
    });

    expect(ioMock.emit).toHaveBeenCalledWith('vote/votesUpdated', expect.objectContaining({
      playerId: 'Student1',
      totals: [3, 1, 3, 2, 1],
      userVotes: expect.objectContaining({
        Student1: { 0: 2, 2: 2, 3: 1 },
      }),
    }));
  });

  test('rejects vote submissions that exceed 5 total stars', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      values: ['Option 1', 'Option 2'],
    });

    socketHost.trigger('vote/setNumbers', {
      roomname,
      id: 'HostTeacher',
    });

    // Attempt to place 6 stars total
    socketGuest1.trigger('vote/setPlayerVotes', {
      roomname,
      playerId: 'Student1',
      votes: { 0: 4, 1: 2 },
    });

    expect(socketGuest1.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      message: expect.stringContaining('cannot place more than 5 stars'),
    }));
  });

  test('builds accurate results matrix for printing breakdown', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      playerNumber: 1,
      isHost: true,
      values: ['Red', 'Green', 'Blue'],
    });

    socketGuest1.trigger('vote/ready', {
      roomname,
      playerId: 'Alice',
      playerNumber: 2,
      isHost: false,
    });

    socketGuest1.trigger('vote/selectNumber', {
      roomname,
      playerId: 'Alice',
      number: 1,
    });

    socketHost.trigger('vote/setNumbers', {
      roomname,
      id: 'HostTeacher',
    });

    socketGuest1.trigger('vote/setPlayerVotes', {
      roomname,
      playerId: 'Alice',
      votes: { 0: 3, 2: 2 },
    });

    expect(ioMock.emit).toHaveBeenCalledWith('vote/votesUpdated', expect.objectContaining({
      results: expect.arrayContaining([
        expect.objectContaining({
          playerId: 'Alice',
          selectedNumber: 1,
          itemVotes: [3, 0, 2],
          totalStars: 5,
        }),
      ]),
    }));
  });

  test('host updates values via vote/updateValues', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      values: ['A', 'B'],
    });

    socketHost.trigger('vote/updateValues', {
      roomname,
      id: 'HostTeacher',
      values: ['Alpha', 'Beta', 'Gamma'],
    });

    expect(ioMock.emit).toHaveBeenCalledWith('vote/sync', expect.objectContaining({
      totalCount: 3,
      values: ['Alpha', 'Beta', 'Gamma'],
    }));
  });

  test('rejoining guest with different values does not overwrite host values', () => {
    // Host readies with host values
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      playerNumber: 1,
      isHost: true,
      values: ['Option 1', 'Option 2', 'Option 3'],
    });

    // Guest readies with guest's local storage values
    socketGuest1.trigger('vote/ready', {
      roomname,
      playerId: 'GuestStudent',
      playerNumber: 2,
      isHost: false,
      values: ['Rogue Vote A', 'Rogue Vote B'],
    });

    // The state values must remain the host values
    const state = voteEvents.getOrCreateVoteState(roomname);
    expect(state.values).toEqual(['Option 1', 'Option 2', 'Option 3']);

    // The broadcast sync must have host values
    expect(ioMock.emit).toHaveBeenLastCalledWith('vote/sync', expect.objectContaining({
      values: ['Option 1', 'Option 2', 'Option 3'],
      totalCount: 3,
    }));
  });

  test('host can directly edit totalCount in numbers stage via vote/setTotalCount', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      values: ['Option 1', 'Option 2'],
    });

    socketGuest1.trigger('vote/selectNumber', {
      roomname,
      playerId: 'Student1',
      number: 5,
    });

    socketHost.trigger('vote/setTotalCount', {
      roomname,
      id: 'HostTeacher',
      totalCount: 3,
    });

    expect(ioMock.emit).toHaveBeenCalledWith('vote/sync', expect.objectContaining({
      stage: 'numbers',
      totalCount: 3,
      customTotalCount: 3,
    }));

    // Student selection of 5 should have been pruned since totalCount is 3
    const state = voteEvents.getOrCreateVoteState(roomname);
    expect(state.numberSelections.has('Student1')).toBe(false);
  });

  test('non-host cannot edit item count in vote', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      isHost: true,
      values: ['Option 1', 'Option 2'],
    });

    socketGuest1.trigger('vote/setTotalCount', {
      roomname,
      id: 'Student1',
      totalCount: 10,
    });

    expect(socketGuest1.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      message: expect.stringContaining('Only the host'),
    }));
  });

  test('handlePlayerLeft removes player from active players while keeping votes and selections intact for rejoin', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'HostTeacher',
      playerNumber: 1,
      isHost: true,
      values: ['Option 1', 'Option 2'],
    });
    socketGuest1.trigger('vote/ready', {
      roomname,
      playerId: 'Student1',
      playerNumber: 2,
      isHost: false,
    });
    socketGuest1.trigger('vote/selectNumber', {
      roomname,
      playerId: 'Student1',
      number: 2,
    });

    const state = voteEvents.getOrCreateVoteState(roomname);
    state.userVotes.set('Student1', { 0: 3, 1: 2 });
    expect(state.players.has('Student1')).toBe(true);
    expect(state.numberSelections.get('Student1')).toBe(2);

    // Player leaves
    voteEvents.handlePlayerLeft(roomname, 'Student1');
    expect(state.players.has('Student1')).toBe(false);
    expect(state.userVotes.get('Student1')).toEqual({ 0: 3, 1: 2 });
    expect(state.numberSelections.get('Student1')).toBe(2);

    // Player rejoins
    socketGuest1.trigger('vote/ready', {
      roomname,
      playerId: 'Student1',
      playerNumber: 2,
      isHost: false,
    });
    expect(state.players.has('Student1')).toBe(true);
    expect(state.userVotes.get('Student1')).toEqual({ 0: 3, 1: 2 });
    expect(state.numberSelections.get('Student1')).toBe(2);
  });

  test('updateHostId updates hostId and host player map entry when host changes name in vote', () => {
    socketHost.trigger('vote/ready', {
      roomname,
      playerId: 'OldHost',
      playerNumber: 1,
      isHost: true,
      values: ['Option 1', 'Option 2'],
    });

    const state = voteEvents.getOrCreateVoteState(roomname);
    expect(state.hostId).toBe('OldHost');
    expect(state.players.has('OldHost')).toBe(true);

    voteEvents.updateHostId(roomname, 'OldHost', 'NewHost');
    expect(state.hostId).toBe('NewHost');
    expect(state.players.has('OldHost')).toBe(false);
    expect(state.players.has('NewHost')).toBe(true);
  });
});

