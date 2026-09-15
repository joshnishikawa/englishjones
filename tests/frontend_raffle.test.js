/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Frontend Raffle Activity - Reveal & Refresh Animation', () => {
  let $;
  let socketMock;
  let socketHandlers;

  beforeAll(() => {
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;

    const commonCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/hosted/common.js'), 'utf8');
    eval(commonCode);

    const raffleCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/hosted/raffle.js'), 'utf8');
    eval(raffleCode);
  });

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="activityStatus"></div>
      <div id="activityControls"></div>
      <div class="container-fluid px-3 py-1 position-relative user-select-none hosted-arena" id="raffle-arena">
        <div id="raffle-pawn-layer"></div>
        <div id="raffle-numbers-screen" class="raffle-screen">
          <div id="raffle-numbers-container" class="hosted-numbers-grid"></div>
        </div>
        <div id="raffle-emojis-screen" class="raffle-screen d-none">
          <div class="row" id="raffle-emojis-container"></div>
        </div>
        <div id="raffle-reveal-screen" class="raffle-screen d-none">
          <div class="row" id="raffle-reveal-container"></div>
        </div>
        <div class="mt-3">
          <div id="raffle-staging-dock"></div>
        </div>
        <div id="raffle-printable-area">
          <table class="table">
            <tbody id="raffle-results-table-body"></tbody>
          </table>
        </div>
      </div>
    `;

    socketHandlers = {};
    socketMock = {
      on: jest.fn((event, cb) => {
        socketHandlers[event] = cb;
      }),
      off: jest.fn((event) => {
        delete socketHandlers[event];
      }),
      emit: jest.fn(),
    };
  });

  afterEach(() => {
    if (window.hostedActivities && window.hostedActivities.raffle) {
      window.hostedActivities.raffle.teardown(socketMock);
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('raffle/revealed plays 3D cascade flip animation', () => {
    window.hostedActivities.raffle.mount({
      socket: socketMock,
      player: { id: 'HostTeacher', roomname: 'test-room', number: 1, color: '#ff0000', isHost: true },
      room: { hostId: 'HostTeacher', players: [{ id: 'HostTeacher', number: 1 }] },
      isHost: true,
      values: ['Gold Star', 'Sticker'],
    });

    // Server triggers raffle/revealed
    socketHandlers['raffle/revealed']({
      shuffledValues: ['Gold Star', 'Sticker'],
      emojis: ['🍎', '🍌'],
      claimedEmojis: { 0: 'HostTeacher' },
      results: [{ playerId: 'HostTeacher', selectedNumber: 1, revealedValue: 'Gold Star' }],
    });

    const $cards = $('#raffle-reveal-container .raffle-flip-card');
    expect($cards.length).toBe(2);

    // Initially when revealed event arrives, cards start unflipped
    expect($cards.eq(0).hasClass('is-flipped')).toBe(false);
    expect($cards.eq(1).hasClass('is-flipped')).toBe(false);

    // Fast-forward 300ms + cascade
    jest.advanceTimersByTime(350);
    expect($cards.eq(0).hasClass('is-flipped')).toBe(true);

    jest.advanceTimersByTime(100);
    expect($cards.eq(1).hasClass('is-flipped')).toBe(true);
  });

  test('raffle/sync on refresh in revealed stage renders cards already flipped without replaying animation', () => {
    window.hostedActivities.raffle.mount({
      socket: socketMock,
      player: { id: 'Student1', roomname: 'test-room', number: 2, color: '#00ff00', isHost: false },
      room: { hostId: 'HostTeacher', players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student1', number: 2 }] },
      isHost: false,
    });

    // Client receives raffle/sync for revealed stage (as happens when refreshed or newly joined)
    socketHandlers['raffle/sync']({
      stage: 'revealed',
      totalCount: 2,
      values: ['Prize A', 'Prize B'],
      emojis: ['🎁', '⭐'],
      claimedEmojis: { 0: 'Student1' },
      players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student1', number: 2 }],
      results: [{ playerId: 'Student1', selectedNumber: 1, revealedValue: 'Prize A' }],
    });

    const $cards = $('#raffle-reveal-container .raffle-flip-card');
    expect($cards.length).toBe(2);

    // Cards must already be flipped immediately without needing cascade timers
    expect($cards.eq(0).hasClass('is-flipped')).toBe(true);
    expect($cards.eq(1).hasClass('is-flipped')).toBe(true);

    // Print table should also be populated
    expect($('#raffle-results-table-body tr').length).toBe(1);
    expect($('#raffle-results-table-body').text()).toContain('Student1');
    expect($('#raffle-results-table-body').text()).toContain('Prize A');
  });

  test('raffle/sync does not re-render or re-animate cards if already revealed on screen', () => {
    window.hostedActivities.raffle.mount({
      socket: socketMock,
      player: { id: 'HostTeacher', roomname: 'test-room', number: 1, color: '#ff0000', isHost: true },
      room: { hostId: 'HostTeacher', players: [{ id: 'HostTeacher', number: 1 }] },
      isHost: true,
    });

    // 1. Initial reveal
    socketHandlers['raffle/revealed']({
      shuffledValues: ['Prize A', 'Prize B'],
      emojis: ['🎁', '⭐'],
      claimedEmojis: {},
      results: [],
    });
    jest.advanceTimersByTime(500);

    const firstCardElementBeforeSync = $('#raffle-flip-0')[0];
    expect(firstCardElementBeforeSync).toBeDefined();
    expect($('#raffle-flip-0').hasClass('is-flipped')).toBe(true);

    // 2. Someone else refreshes and sends raffle/ready -> server emits raffle/sync to room
    socketHandlers['raffle/sync']({
      stage: 'revealed',
      totalCount: 2,
      values: ['Prize A', 'Prize B'],
      emojis: ['🎁', '⭐'],
      claimedEmojis: {},
      players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student2', number: 2 }],
      results: [],
    });

    // The DOM element must be identical (not destroyed and recreated)
    const firstCardElementAfterSync = $('#raffle-flip-0')[0];
    expect(firstCardElementAfterSync).toBe(firstCardElementBeforeSync);
    expect($('#raffle-flip-0').hasClass('is-flipped')).toBe(true);
  });
});
