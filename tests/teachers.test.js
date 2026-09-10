const express = require('express');
const request = require('supertest');
const router = require('../routes/teachers');
const nhHelpers = require('../config/nh_helpers');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../config/nh_helpers', () => ({
  NH_colors: { '8_9': 'green', '10_11': 'blue' },
  getNHVocab: jest.fn().mockResolvedValue({
    '8_9': { feelings: { happy: 1 } },
  }),
}));

describe('Teachers Router', () => {
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
    app.use('/teachers', router);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('GET /teachers should redirect to /teachers/NH', async () => {
    const response = await request(app).get('/teachers');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/teachers/NH');
  });

  test('GET /teachers/images should render teachers/images', async () => {
    const response = await request(app).get('/teachers/images');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('teachers/images', expect.any(Object), expect.any(Function));
  });

  test('GET /teachers/LT should render teachers/LT with LT_vocab', async () => {
    const response = await request(app).get('/teachers/LT');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('teachers/LT', expect.objectContaining({
      LT_vocab: expect.any(Object),
    }), expect.any(Function));
  });

  test('GET /teachers/NH should render teachers/NH with NH_vocab and colors', async () => {
    const response = await request(app).get('/teachers/NH');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('teachers/NH', expect.objectContaining({
      NH_vocab: { '8_9': { feelings: { happy: 1 } } },
      colors: { '8_9': 'green', '10_11': 'blue' },
    }), expect.any(Function));
  });

  test('GET /teachers/text should render teachers/text with text_decks', async () => {
    const response = await request(app).get('/teachers/text');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('teachers/text', expect.objectContaining({
      text_decks: expect.any(Object),
    }), expect.any(Function));
  });

  test('GET /teachers/lobby should render lobby/lobby with isTeacher true', async () => {
    const response = await request(app).get('/teachers/lobby');
    expect(response.status).toBe(200);
    expect(app.render).toHaveBeenCalledWith('lobby/lobby', expect.objectContaining({
      isTeacher: true,
      teacher: true,
      activities: expect.any(Array),
    }), expect.any(Function));
  });

  test('GET /teachers/multiplayer should redirect to /teachers/lobby', async () => {
    const response = await request(app).get('/teachers/multiplayer');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/teachers/lobby');
  });

  test('GET /teachers/multiplayer/race should redirect to /teachers/lobby/race', async () => {
    const response = await request(app).get('/teachers/multiplayer/race');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/teachers/lobby/race');
  });

  test('should handle errors with 500 status and error view', async () => {
    renderError = true;
    const response = await request(app).get('/teachers/images');
    expect(response.status).toBe(500);
    expect(app.render).toHaveBeenCalledWith('error', expect.any(Object), expect.any(Function));
  });
});
