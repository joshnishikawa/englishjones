/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Frontend Lobby Public Rooms Activity Filtering', () => {
  let $;
  let socketMock;

  beforeEach(() => {
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;

    $(document).off();

    document.body.innerHTML = `
      <script id="activitiesConfigData" type="application/json">
        [
          {"id":"choose","label":"Choose","group":"standard","enabled":true},
          {"id":"race","label":"Race","group":"standard","enabled":true},
          {"id":"match","label":"Match","group":"standard","enabled":true},
          {"id":"popquiz","label":"Pop Quiz","group":"host","enabled":true},
          {"id":"raffle","label":"Raffle","group":"host","enabled":true},
          {"id":"vote","label":"Vote","group":"host","enabled":true}
        ]
      </script>
      <div id="studentSideMenu"></div>
      <div id="lobbyColumn" class="col-sm-4 mb-3">
        <div id="myGroup">
          <div id="roomname">my-room</div>
          <div id="userCount">1 user</div>
          <div id="myPawn"></div>
          <div id="myName"></div>
          <button id="getName"></button>
          <input id="color" type="color" />
          <div id="otherPlayers"></div>
          <div id="leaveGroup" style="display: none;"></div>
        </div>
        <div id="group" style="display: none;">
          <div id="foundplayers"></div>
          <form id="roomSearchForm">
            <button id="join" disabled></button>
            <input id="roomSearch" />
          </form>
          <div id="publicRoomsContainer" style="display: none;">
            <div id="publicRoomsList"></div>
          </div>
        </div>
      </div>
      <div id="activityColumn" class="col-sm-8">
        <div id="activityHeader">
          <button id="activityExit" class="d-none"></button>
          <span id="activityHostBadge" class="d-none"></span>
          <div id="activityRoomName"></div>
          <div id="activityStatus"></div>
          <div id="activityControls"></div>
        </div>
        <div id="activityMenu">
          <div id="standardActivities">
            <button class="activity" id="race" data-group="standard">
              <span class="host-pawn"></span>
              <span class="activity-label">Race</span>
              <span class="activity-pawns"></span>
            </button>
            <button class="activity" id="match" data-group="standard">
              <span class="host-pawn"></span>
              <span class="activity-label">Match</span>
              <span class="activity-pawns"></span>
            </button>
          </div>
          <div id="hostActivities">
            <div class="host-activity-row" id="row-popquiz">
              <button class="activity" id="popquiz" data-group="host">
                <span class="host-pawn"></span>
                <span class="activity-label">Pop Quiz</span>
                <span class="activity-pawns"></span>
              </button>
              <button class="start-activity-btn d-none" data-activity="popquiz">Start</button>
            </div>
            <div class="host-activity-row" id="row-raffle">
              <button class="activity" id="raffle" data-group="host">
                <span class="host-pawn"></span>
                <span class="activity-label">Raffle</span>
                <span class="activity-pawns"></span>
              </button>
              <button class="start-activity-btn d-none" data-activity="raffle">Start</button>
            </div>
          </div>
        </div>
        <div id="activityContent"></div>
      </div>
      <div id="hostBadge" class="d-none"></div>
    `;

    socketMock = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };
    global.io = jest.fn(() => socketMock);

    const storage = {};
    global.localStorage = {
      getItem: jest.fn((k) => storage[k] || null),
      setItem: jest.fn((k, v) => { storage[k] = v; }),
      removeItem: jest.fn((k) => { delete storage[k]; }),
      clear: jest.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
    };
  });

  afterEach(() => {
    $(document).off();
    jest.resetModules();
  });

  test('public groups are hidden until an activity is selected and only show groups for that activity', async () => {
    const lobbyCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/lobby.js'), 'utf8');
    eval(lobbyCode);

    await new Promise((r) => setTimeout(r, 20));

    const socketOnHandlers = {};
    socketMock.on.mock.calls.forEach(([evt, handler]) => {
      socketOnHandlers[evt] = handler;
    });

    const hostPlayer = {
      id: 'Player1',
      number: 1,
      roomname: 'my-room',
      roomtype: 'private',
      color: '#0d6efd',
      activity: null,
    };

    const roomData = {
      roomname: 'my-room',
      roomtype: 'private',
      hostId: 'Player1',
      players: [hostPlayer],
      activity: null,
      selectedHostActivity: null,
    };

    socketOnHandlers['setName']({ id: 'Player1', number: 1 });
    socketOnHandlers['joined']({ room: roomData, playerNum: 1 });

    const samplePublicRooms = [
      { roomname: 'room-race-1', activity: 'race', playerCount: 1, players: [{ id: 'p2', color: '#ff0000' }] },
      { roomname: 'room-race-2', activity: 'race', playerCount: 2, players: [{ id: 'p3', color: '#00ff00' }] },
      { roomname: 'room-popquiz', activity: 'popquiz', isHostActivity: true, playerCount: 3, players: [{ id: 'p4', color: '#123456' }] },
      { roomname: 'my-room', activity: 'race', playerCount: 1, players: [hostPlayer] },
    ];

    // 1. Receive public rooms list before selecting an activity
    socketOnHandlers['publicRoomsList'](samplePublicRooms);

    // Public rooms container must be hidden
    expect($('#publicRoomsContainer').css('display')).toBe('none');
    expect($('#publicRoomsList').children().length).toBe(0);

    // 2. Select 'race' activity
    $('#race').trigger('click');

    // Public rooms container must now be visible and only contain the 2 other 'race' rooms (excluding own room)
    expect($('#publicRoomsContainer').css('display')).not.toBe('none');
    expect($('#publicRoomsList').children().length).toBe(2);
    expect($('#publicRoomsList').find('[data-room="room-race-1"]').length).toBe(1);
    expect($('#publicRoomsList').find('[data-room="room-race-2"]').length).toBe(1);
    expect($('#publicRoomsList').find('[data-room="room-popquiz"]').length).toBe(0);
    expect($('#publicRoomsList').find('[data-room="my-room"]').length).toBe(0);

    // 3. Switch to 'popquiz' activity
    $('#popquiz').trigger('click');

    // Public rooms container should update to only show 'popquiz'
    expect($('#publicRoomsContainer').css('display')).not.toBe('none');
    expect($('#publicRoomsList').children().length).toBe(1);
    expect($('#publicRoomsList').find('[data-room="room-popquiz"]').length).toBe(1);
    expect($('#publicRoomsList').find('[data-room="room-race-1"]').length).toBe(0);

    // 4. Select 'match' activity which has NO public rooms available
    $('#match').trigger('click');

    // Public rooms container must be hidden because no groups match 'match'
    expect($('#publicRoomsContainer').css('display')).toBe('none');
    expect($('#publicRoomsList').children().length).toBe(0);

    // 5. Deselect 'match' activity (clicking again)
    $('#match').trigger('click');

    // Public rooms container must remain hidden
    expect($('#publicRoomsContainer').css('display')).toBe('none');
  });

  test('clicking on a public room button emits join event', async () => {
    const lobbyCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/lobby.js'), 'utf8');
    eval(lobbyCode);

    await new Promise((r) => setTimeout(r, 20));

    const socketOnHandlers = {};
    socketMock.on.mock.calls.forEach(([evt, handler]) => {
      socketOnHandlers[evt] = handler;
    });

    const hostPlayer = {
      id: 'Player1',
      number: 1,
      roomname: 'my-room',
      roomtype: 'private',
      color: '#0d6efd',
      activity: null,
    };

    socketOnHandlers['joined']({
      room: {
        roomname: 'my-room',
        roomtype: 'private',
        hostId: 'Player1',
        players: [hostPlayer],
        activity: null,
      },
      playerNum: 1,
    });

    socketOnHandlers['publicRoomsList']([
      { roomname: 'speed-zone', activity: 'race', playerCount: 1, players: [{ id: 'other' }] },
    ]);

    $('#race').trigger('click');

    const $btn = $('.public-room-btn[data-room="speed-zone"]');
    expect($btn.length).toBe(1);

    $btn.trigger('click');

    expect(socketMock.emit).toHaveBeenCalledWith('join', {
      newRoom: 'speed-zone',
      player: expect.objectContaining({
        activity: 'race',
      }),
    });
  });

  test('group search/public panel is visible when solitary and hides when another player joins', async () => {
    const lobbyCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/lobby.js'), 'utf8');
    eval(lobbyCode);

    await new Promise((r) => setTimeout(r, 20));

    const socketOnHandlers = {};
    socketMock.on.mock.calls.forEach(([evt, handler]) => {
      socketOnHandlers[evt] = handler;
    });

    const player1 = { id: 'Player1', number: 1, roomname: 'room-a', color: '#0d6efd', activity: 'race' };
    const player2 = { id: 'Player2', number: 2, roomname: 'room-a', color: '#ff0000', activity: 'race' };

    // Initial solitary state
    socketOnHandlers['joined']({
      room: { roomname: 'room-a', roomtype: 'public', hostId: 'Player1', players: [player1], activity: null },
      playerNum: 1,
    });

    expect($('#group').hasClass('d-none')).toBe(false);
    expect($('#group').css('display')).not.toBe('none');
    expect($('#leaveGroup').css('display')).toBe('none');

    // Another player joins room-a
    socketOnHandlers['playerJoined']([player1, player2]);

    expect($('#group').hasClass('d-none')).toBe(true);
    expect($('#group').css('display')).toBe('none');
    expect($('#leaveGroup').css('display')).not.toBe('none');

    // Player 2 leaves, solitary again
    socketOnHandlers['playerLeft']([player1]);

    expect($('#group').hasClass('d-none')).toBe(false);
    expect($('#group').css('display')).not.toBe('none');
    expect($('#leaveGroup').css('display')).toBe('none');
  });

  test('submitting roomSearchForm immediately emits join with lowercase room name without waiting for debounce', async () => {
    const lobbyCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/lobby.js'), 'utf8');
    eval(lobbyCode);

    await new Promise((r) => setTimeout(r, 20));

    $('#roomSearch').val('  CAT  ').trigger('input');

    // #join should be enabled upon typing
    expect($('#join').prop('disabled')).toBe(false);

    $('#roomSearchForm').trigger('submit');

    expect(socketMock.emit).toHaveBeenCalledWith('join', {
      newRoom: 'cat',
      player: expect.any(Object),
    });
    expect($('#roomSearch').val()).toBe('');
    expect($('#join').prop('disabled')).toBe(true);
  });

  test('joined event with error message displays the error in #foundplayers', async () => {
    const lobbyCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/lobby.js'), 'utf8');
    eval(lobbyCode);

    await new Promise((r) => setTimeout(r, 20));

    const socketOnHandlers = {};
    socketMock.on.mock.calls.forEach(([evt, handler]) => {
      socketOnHandlers[evt] = handler;
    });

    socketOnHandlers['joined']({ message: 'Room not found.' });

    expect($('#foundplayers').text()).toContain('Room not found.');
    expect($('#foundplayers').find('.text-danger').length).toBe(1);
  });

  test('roomSearch input clears placeholder on focus and restores it on blur', async () => {
    $('#roomSearch').attr('placeholder', 'join');
    const lobbyCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/lobby.js'), 'utf8');
    eval(lobbyCode);

    await new Promise((r) => setTimeout(r, 20));

    expect($('#roomSearch').attr('placeholder')).toBe('join');

    $('#roomSearch').trigger('focus');
    expect($('#roomSearch').attr('placeholder')).toBe('');

    $('#roomSearch').trigger('blur');
    expect($('#roomSearch').attr('placeholder')).toBe('join');
  });

  test('updates #userCount to show singular and plural user count', async () => {
    const lobbyCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/lobby.js'), 'utf8');
    eval(lobbyCode);

    await new Promise((r) => setTimeout(r, 20));

    // Initially 1 user joined
    const joinedHandler = socketMock.on.mock.calls.find((c) => c[0] === 'joined')[1];
    joinedHandler({
      room: {
        roomname: 'my-room',
        players: [{ id: 'Player1', color: '#ff0000', number: 1 }],
      },
      playerNum: 1,
    });

    expect($('#userCount').text()).toBe('1 user');

    // Second player joins
    const playerJoinedHandler = socketMock.on.mock.calls.find((c) => c[0] === 'playerJoined')[1];
    playerJoinedHandler([
      { id: 'Player1', color: '#ff0000', number: 1 },
      { id: 'Player2', color: '#00ff00', number: 2 },
    ]);

    expect($('#userCount').text()).toBe('2 users');

    // Third player joins
    playerJoinedHandler([
      { id: 'Player1', color: '#ff0000', number: 1 },
      { id: 'Player2', color: '#00ff00', number: 2 },
      { id: 'Player3', color: '#0000ff', number: 3 },
    ]);

    expect($('#userCount').text()).toBe('3 users');

    // Player leaves room
    const youLeftHandler = socketMock.on.mock.calls.find((c) => c[0] === 'youLeft')[1];
    youLeftHandler();

    expect($('#userCount').text()).toBe('1 user');
  });
});

