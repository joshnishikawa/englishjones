const express = require('express');
const request = require('supertest');
const router = require('../routes/lobby');

describe('Multiplayer Router', () => {
  let app;
  let renderError = false;
  let consoleErrorSpy;

  beforeEach(() => {
    renderError = false;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    app = express();
    app.set('view engine', 'ejs');
    app.render = jest.fn((view, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      if (renderError) {
        throw new Error('Synchronous render exception');
      }
      cb(null, `Mocked ${view} content`);
    });
    app.use('/multiplayer', router);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('GET /multiplayer should render lobby/lobby with enabled activities and isTeacher false', async () => {
    const response = await request(app).get('/multiplayer');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/lobby', expect.objectContaining({
      activities: expect.any(Array),
      isTeacher: false,
      teacher: false,
    }), expect.any(Function));
  });

  test('GET /teachers/lobby should render lobby/lobby with isTeacher true', async () => {
    const teacherApp = express();
    teacherApp.set('view engine', 'ejs');
    teacherApp.render = jest.fn((view, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      cb(null, `Mocked ${view} content`);
    });
    teacherApp.use('/teachers/lobby', router);
    const response = await request(teacherApp).get('/teachers/lobby');
    expect(response.status).toBe(200);
    expect(teacherApp.render).toHaveBeenCalledWith('lobby/lobby', expect.objectContaining({
      activities: expect.any(Array),
      isTeacher: true,
      teacher: true,
    }), expect.any(Function));
  });

  test('GET /multiplayer?teacher=1 should render lobby/lobby with isTeacher true', async () => {
    const response = await request(app).get('/multiplayer?teacher=1');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/lobby', expect.objectContaining({
      activities: expect.any(Array),
      isTeacher: true,
      teacher: true,
    }), expect.any(Function));
  });

  test('GET /multiplayer/race should render race index', async () => {
    const response = await request(app).get('/multiplayer/race');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/multiplayer/race/index', expect.any(Object), expect.any(Function));
  });

  test('GET /multiplayer/choose should render choose index', async () => {
    const response = await request(app).get('/multiplayer/choose');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/multiplayer/choose/index', expect.any(Object), expect.any(Function));
  });

  test('GET /multiplayer/match should render match index', async () => {
    const response = await request(app).get('/multiplayer/match');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/multiplayer/match/index', expect.any(Object), expect.any(Function));
  });

  test('GET /multiplayer/popquiz should render popquiz index', async () => {
    const response = await request(app).get('/multiplayer/popquiz');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/hosted/popquiz/index', expect.any(Object), expect.any(Function));
  });

  test('GET /multiplayer/raffle should render raffle index', async () => {
    const response = await request(app).get('/multiplayer/raffle');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/hosted/raffle/index', expect.any(Object), expect.any(Function));
  });

  test('GET /multiplayer/vote should render vote index', async () => {
    const response = await request(app).get('/multiplayer/vote');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/hosted/vote/index', expect.any(Object), expect.any(Function));
  });

  test('should handle render errors by returning 500 and error view', async () => {
    renderError = true;
    const response = await request(app).get('/multiplayer');
    expect(response.status).toBe(500);
    expect(app.render).toHaveBeenCalledWith('error', expect.any(Object), expect.any(Function));
  });
});

describe('Hosted Activities Router', () => {
  let app;
  let renderError = false;
  let consoleErrorSpy;
  const { hostedRouter } = require('../routes/lobby');

  beforeEach(() => {
    renderError = false;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    app = express();
    app.set('view engine', 'ejs');
    app.render = jest.fn((view, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      if (renderError) {
        throw new Error('Synchronous render exception');
      }
      cb(null, `Mocked ${view} content`);
    });
    app.use('/hosted', hostedRouter);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('GET /hosted/popquiz should render hosted popquiz index', async () => {
    const response = await request(app).get('/hosted/popquiz');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/hosted/popquiz/index', expect.any(Object), expect.any(Function));
  });

  test('GET /hosted/raffle should render hosted raffle index', async () => {
    const response = await request(app).get('/hosted/raffle');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/hosted/raffle/index', expect.any(Object), expect.any(Function));
  });

  test('GET /hosted/vote should render hosted vote index', async () => {
    const response = await request(app).get('/hosted/vote');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/hosted/vote/index', expect.any(Object), expect.any(Function));
  });

  test('should handle render errors by returning 500 and error view', async () => {
    renderError = true;
    const response = await request(app).get('/hosted/popquiz');
    expect(response.status).toBe(500);
    expect(app.render).toHaveBeenCalledWith('error', expect.any(Object), expect.any(Function));
  });
});

describe('Multiplayer View Rendering', () => {
  const ejs = require('ejs');
  const path = require('path');
  const activities = require('../config/multiplayer_activities.js').filter((a) => a.enabled);

  test('renders lobby.ejs with student navbar when isTeacher is false', async () => {
    const filePath = path.join(__dirname, '../views/lobby/lobby.ejs');
    const html = await ejs.renderFile(filePath, {
      activities,
      isTeacher: false,
      teacher: false,
      locale: 'en',
      __: (key) => key,
    });
    expect(html).toContain('id="studentSideMenu"');
    expect(html).toContain('id="navbar"');
    expect(html).toContain('id="lobby-tab"');
    expect(html).toContain('Letters');
    expect(html).toContain("$('#lobby-tab').addClass('active')");
    expect(html).not.toContain('id="sidenavbar"');
  });

  test('renders lobby.ejs with teacher navbar when isTeacher is true', async () => {
    const filePath = path.join(__dirname, '../views/lobby/lobby.ejs');
    const html = await ejs.renderFile(filePath, {
      activities,
      isTeacher: true,
      teacher: true,
      locale: 'en',
      __: (key) => key,
    });
    expect(html).toContain('id="studentSideMenu"');
    expect(html).toContain('id="sidenavbar"');
    expect(html).toContain('id="lobby-tab"');
    expect(html).toContain('/teachers/lobby');
    expect(html).toContain("$('#lobby-tab').addClass('active')");
  });
});

