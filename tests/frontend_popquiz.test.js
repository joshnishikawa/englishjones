/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Frontend Pop Quiz Activity - Pawn Positioning on Round Start', () => {
  let $;
  let socketMock;
  let socketHandlers;

  beforeAll(() => {
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;

    const commonCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/hosted/common.js'), 'utf8');
    eval(commonCode);

    const popquizCode = fs.readFileSync(path.join(__dirname, '../public/javascripts/lobby/hosted/popquiz.js'), 'utf8');
    eval(popquizCode);
  });

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="activityStatus"></div>
      <div id="activityControls"></div>
      <div class="container-fluid px-3 py-1 position-relative user-select-none hosted-arena" id="popquiz-arena">
        <div id="popquiz-pawn-layer"></div>
        <div id="popquiz-numbers-screen" class="popquiz-screen">
          <div id="popquiz-numbers-container" class="hosted-numbers-grid"></div>
        </div>
        <div id="popquiz-quiz-screen" class="popquiz-screen d-none">
          <div id="popquiz-choices-container" class="row g-3 justify-content-center my-2"></div>
        </div>
        <div class="mt-2" id="popquiz-dock-container">
          <div id="popquiz-staging-dock" class="d-flex justify-content-center align-items-center"></div>
        </div>
        <div id="popquiz-gameover-screen" class="popquiz-screen d-none text-center py-4">
          <div id="popquiz-winners-container" class="row justify-content-center g-4 mb-5"></div>
        </div>
        <div id="popquiz-printable-area">
          <div id="popquiz-print-meta"></div>
          <table class="table">
            <tbody id="popquiz-results-table-body"></tbody>
          </table>
        </div>
      </div>
    `;

    // Mock getBoundingClientRect for arena and dock so coordinate positions can be verified
    const arenaEl = document.getElementById('popquiz-arena');
    arenaEl.getBoundingClientRect = () => ({
      top: 100,
      left: 50,
      bottom: 700,
      right: 850,
      width: 800,
      height: 600,
      x: 50,
      y: 100,
    });

    Object.defineProperty(arenaEl, 'offsetWidth', { configurable: true, value: 800 });
    Object.defineProperty(arenaEl, 'offsetHeight', { configurable: true, value: 600 });
    arenaEl.getClientRects = () => [{ width: 800, height: 600 }];

    const dockEl = document.getElementById('popquiz-staging-dock');
    dockEl.getBoundingClientRect = () => ({
      top: 600,
      left: 100,
      bottom: 680,
      right: 800,
      width: 700,
      height: 80,
      x: 100,
      y: 600,
    });
    Object.defineProperty(dockEl, 'offsetWidth', { configurable: true, value: 700 });
    Object.defineProperty(dockEl, 'offsetHeight', { configurable: true, value: 80 });
    dockEl.getClientRects = () => [{ width: 700, height: 80 }];

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
    if (window.hostedActivities && window.hostedActivities.popquiz) {
      window.hostedActivities.popquiz.teardown(socketMock);
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('Question 1 of Pop Quiz positions pawns at the staging dock (bottom), not top-left', () => {
    window.hostedActivities.popquiz.mount({
      socket: socketMock,
      player: { id: 'Student1', roomname: 'quiz-room', number: 2, color: '#0d6efd', isHost: false },
      room: { hostId: 'HostTeacher', players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student1', number: 2 }] },
      isHost: false,
    });

    // Phase 1: Numbers sync
    socketHandlers['popquiz/sync']({
      stage: 'numbers',
      totalCount: 4,
      hostId: 'HostTeacher',
      players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student1', number: 2 }],
      numberSelections: { Student1: 1 },
      scores: { Student1: 0 },
    });

    // Student has selected card 1 in Phase 1
    socketHandlers['popquiz/numberSelected']({
      playerId: 'Student1',
      number: 1,
    });

    jest.advanceTimersByTime(100);

    // Now host triggers question 1 (first question of quiz)
    socketHandlers['popquiz/roundstart']({
      questionIndex: 0,
      totalQuestions: 3,
      choices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
      scores: { Student1: 0 },
      players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student1', number: 2 }],
      hostId: 'HostTeacher',
    });

    jest.advanceTimersByTime(100);

    // Verify screens
    expect($('#popquiz-numbers-screen').hasClass('d-none')).toBe(true);
    expect($('#popquiz-quiz-screen').hasClass('d-none')).toBe(false);

    // Verify token position
    const $token = $('#token-Student1');
    expect($token.length).toBe(1);

    const transform = $token.css('transform');
    expect(transform).toBeDefined();

    // In our mock, dock top is 600, arena top is 100 -> dockStartY is >= 500
    // If the pawn was erroneously positioned at top-left, posY would be near 0 or negative
    const match = /translate3d\(([^,]+)px,\s*([^,]+)px/.exec(transform);
    expect(match).not.toBeNull();
    const posY = parseFloat(match[2]);

    // Position Y must be located at the bottom dock (>= 500px), NOT at top-left (< 100px)
    expect(posY).toBeGreaterThanOrEqual(500);
  });

  test('Subsequent questions also position pawns at the staging dock', () => {
    window.hostedActivities.popquiz.mount({
      socket: socketMock,
      player: { id: 'Student1', roomname: 'quiz-room', number: 2, color: '#0d6efd', isHost: false },
      room: { hostId: 'HostTeacher', players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student1', number: 2 }] },
      isHost: false,
    });

    // Question 2 roundstart
    socketHandlers['popquiz/roundstart']({
      questionIndex: 1,
      totalQuestions: 3,
      choices: ['Choice X', 'Choice Y', 'Choice Z', 'Choice W'],
      scores: { Student1: 1 },
      players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student1', number: 2 }],
      hostId: 'HostTeacher',
    });

    jest.advanceTimersByTime(100);

    const $token = $('#token-Student1');
    const transform = $token.css('transform');
    const match = /translate3d\(([^,]+)px,\s*([^,]+)px/.exec(transform);
    expect(match).not.toBeNull();
    const posY = parseFloat(match[2]);
    expect(posY).toBeGreaterThanOrEqual(500);
  });

  test('Pawn glides to choice card when student selects an answer', () => {
    window.hostedActivities.popquiz.mount({
      socket: socketMock,
      player: { id: 'Student1', roomname: 'quiz-room', number: 2, color: '#0d6efd', isHost: false },
      room: { hostId: 'HostTeacher', players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student1', number: 2 }] },
      isHost: false,
    });

    socketHandlers['popquiz/roundstart']({
      questionIndex: 0,
      totalQuestions: 3,
      choices: ['Apple', 'Banana', 'Cherry', 'Date'],
      scores: { Student1: 0 },
      players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student1', number: 2 }],
      hostId: 'HostTeacher',
    });

    // Mock choice card getBoundingClientRect
    const choiceCardEl = document.getElementById('choice-1');
    expect(choiceCardEl).not.toBeNull();
    choiceCardEl.getBoundingClientRect = () => ({
      top: 250,
      left: 450,
      bottom: 450,
      right: 750,
      width: 300,
      height: 200,
      x: 450,
      y: 250,
    });

    // Student selects choice 1
    socketHandlers['popquiz/playerselected']({
      playerId: 'Student1',
      choiceIndex: 1,
    });

    jest.advanceTimersByTime(50);

    const $token = $('#token-Student1');
    const transform = $token.css('transform');
    const match = /translate3d\(([^,]+)px,\s*([^,]+)px/.exec(transform);
    expect(match).not.toBeNull();
    const posX = parseFloat(match[1]);
    const posY = parseFloat(match[2]);

    // Position should be on choice 1 (around arenaX: 450-50=400, arenaY: 250-100=150)
    expect(posX).toBeGreaterThanOrEqual(300);
    expect(posY).toBeLessThan(400);
  });

  test('popquiz/sync with stage quiz puts pawns in the staging dock, not on hidden number cards', () => {
    window.hostedActivities.popquiz.mount({
      socket: socketMock,
      player: { id: 'Student1', roomname: 'quiz-room', number: 2, color: '#0d6efd', isHost: false },
      room: { hostId: 'HostTeacher', players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student1', number: 2 }] },
      isHost: false,
    });

    // Client receives sync for quiz stage while having numberSelections from earlier
    socketHandlers['popquiz/sync']({
      stage: 'quiz',
      questionIndex: 0,
      totalQuestions: 2,
      choices: ['A', 'B', 'C', 'D'],
      numberSelections: { Student1: 2 },
      players: [{ id: 'HostTeacher', number: 1 }, { id: 'Student1', number: 2 }],
      scores: { Student1: 0 },
    });

    jest.advanceTimersByTime(100);

    const $token = $('#token-Student1');
    const transform = $token.css('transform');
    const match = /translate3d\(([^,]+)px,\s*([^,]+)px/.exec(transform);
    expect(match).not.toBeNull();
    const posY = parseFloat(match[2]);
    expect(posY).toBeGreaterThanOrEqual(500);
  });
});
