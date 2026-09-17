/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Frontend Lobby Color Synchronization', () => {
  let $;
  let socketMock;
  let socketOnHandlers;
  let storage;

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
          <input id="color" type="color" value="#ff0000" />
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
              <div class="activity" id="popquiz" data-group="host">
                <span class="activity-label">Pop Quiz</span>
                <span class="activity-pawns"></span>
                <button class="start-activity-btn d-none" data-activity="popquiz">Start</button>
              </div>
            </div>
            <div class="host-activity-row" id="row-raffle">
              <div class="activity" id="raffle" data-group="host">
                <span class="activity-label">Raffle</span>
                <span class="activity-pawns"></span>
                <button class="start-activity-btn d-none" data-activity="raffle">Start</button>
              </div>
            </div>
          </div>
        </div>
        <div id="activityContent"></div>
      </div>
    `;

    const socketListeners = {};
    socketMock = {
      emit: jest.fn(),
      on: jest.fn((evt, fn) => {
        if (!socketListeners[evt]) socketListeners[evt] = [];
        socketListeners[evt].push(fn);
      }),
      off: jest.fn((evt, fn) => {
        if (!fn) {
          delete socketListeners[evt];
        } else if (socketListeners[evt]) {
          socketListeners[evt] = socketListeners[evt].filter((h) => h !== fn);
        }
      }),
    };
    socketOnHandlers = new Proxy(socketListeners, {
      get: (target, prop) => {
        if (typeof prop === 'string') {
          if (!target[prop] || target[prop].length === 0) return undefined;
          return (...args) => {
            target[prop].slice().forEach((h) => h(...args));
          };
        }
        return undefined;
      },
    });
    global.io = jest.fn(() => socketMock);

    storage = {};
    const storageMock = {
      getItem: jest.fn((k) => (storage[k] !== undefined ? storage[k] : null)),
      setItem: jest.fn((k, v) => { storage[k] = String(v); }),
      removeItem: jest.fn((k) => { delete storage[k]; }),
      clear: jest.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
    };
    Object.defineProperty(window, 'localStorage', {
      value: storageMock,
      writable: true,
      configurable: true,
    });
    global.localStorage = storageMock;
  });

  afterEach(() => {
    $(document).off();
    jest.resetModules();
  });

  test('updates other player color when host receives setColor from guest', async () => {
    storage['player'] = JSON.stringify({
      id: 'Player1',
      number: 1,
      color: '#ff0000',
      roomname: 'my-room',
      roomtype: 'private',
    });

    const lobbyCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/lobby.js'), 'utf8');
    eval(lobbyCode);

    await new Promise((r) => setTimeout(r, 20));

    // Player 1 (Host) joins
    socketOnHandlers['joined']({
      room: {
        roomname: 'my-room',
        hostId: 'Player1',
        players: [{ id: 'Player1', color: '#ff0000', number: 1 }],
      },
      playerNum: 1,
    });

    // Player 2 joins
    socketOnHandlers['playerJoined']([
      { id: 'Player1', color: '#ff0000', number: 1 },
      { id: 'Player2', color: '#0000ff', number: 2 },
    ]);

    expect($('#otherPlayers').text()).toContain('Player2');
    expect($('#otherPlayers').html()).toContain('#0000ff');

    // Player 2 changes color to #00ff00
    socketOnHandlers['setColor']({
      id: 'Player2',
      number: 2,
      color: '#00ff00',
    });

    expect($('#otherPlayers').html()).toContain('#00ff00');
    expect($('#otherPlayers').html()).not.toContain('#0000ff');
  });

  test('updates host color when guest receives setColor from host', async () => {
    storage['player'] = JSON.stringify({
      id: 'Player2',
      number: 2,
      color: '#0000ff',
      roomname: 'my-room',
      roomtype: 'private',
    });

    const lobbyCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/lobby.js'), 'utf8');
    eval(lobbyCode);

    await new Promise((r) => setTimeout(r, 20));

    // Player 2 (Guest) joins Player 1's room
    socketOnHandlers['joined']({
      room: {
        roomname: 'my-room',
        hostId: 'Player1',
        players: [
          { id: 'Player1', color: '#ff0000', number: 1 },
          { id: 'Player2', color: '#0000ff', number: 2 },
        ],
      },
      playerNum: 2,
    });

    expect($('#otherPlayers').text()).toContain('Player1');
    expect($('#otherPlayers').html()).toContain('#ff0000');

    // Host changes color to #ff00ff
    socketOnHandlers['setColor']({
      id: 'Player1',
      number: 1,
      color: '#ff00ff',
    });

    expect($('#otherPlayers').html()).toContain('#ff00ff');
    expect($('#otherPlayers').html()).not.toContain('#ff0000');
  });

  test('changing color in color picker emits setColor and updates local pawn immediately on input event', async () => {
    storage['player'] = JSON.stringify({
      id: 'Player1',
      number: 1,
      color: '#ff0000',
      roomname: 'my-room',
      roomtype: 'private',
    });

    const lobbyCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/lobby.js'), 'utf8');
    eval(lobbyCode);

    await new Promise((r) => setTimeout(r, 20));

    socketOnHandlers['joined']({
      room: {
        roomname: 'my-room',
        hostId: 'Player1',
        players: [{ id: 'Player1', color: '#ff0000', number: 1 }],
      },
      playerNum: 1,
    });

    // Trigger 'input' event on color picker
    $('#color').val('#123456').trigger('input');

    expect($('#myPawn').html()).toContain('#123456');
    expect(socketMock.emit).toHaveBeenCalledWith('setColor', expect.objectContaining({
      color: '#123456',
    }));
  });

  test('activity teardown does not remove lobby setColor listener', async () => {
    storage['player'] = JSON.stringify({
      id: 'Player1',
      number: 1,
      color: '#ff0000',
      roomname: 'my-room',
      roomtype: 'private',
    });

    const lobbyCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/lobby.js'), 'utf8');
    eval(lobbyCode);

    const popquizCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/hosted/popquiz.js'), 'utf8');
    eval(popquizCode);

    await new Promise((r) => setTimeout(r, 20));

    socketOnHandlers['joined']({
      room: {
        roomname: 'my-room',
        hostId: 'Player1',
        players: [
          { id: 'Player1', color: '#ff0000', number: 1 },
          { id: 'Player2', color: '#0000ff', number: 2 },
        ],
      },
      playerNum: 1,
    });

    // Mount and then teardown popquiz
    window.hostedActivities.popquiz.mount({
      socket: socketMock,
      player: { id: 'Player1', number: 1, color: '#ff0000' },
      room: { roomname: 'my-room', hostId: 'Player1', players: [] },
      isHost: true,
    });

    window.hostedActivities.popquiz.teardown(socketMock);

    // After popquiz teardown, lobby setColor handler must still exist!
    expect(socketOnHandlers['setColor']).toBeDefined();

    // Player 2 changes color in lobby after returning from activity
    socketOnHandlers['setColor']({
      id: 'Player2',
      number: 2,
      color: '#abcdef',
    });

    expect($('#otherPlayers').html()).toContain('#abcdef');
  });
});
