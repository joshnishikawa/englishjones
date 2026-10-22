const express = require('express');
const request = require('supertest');
const router = require('../routes/_MAIN');
const fs = require('fs');

jest.mock('fs');
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));
jest.mock('../config/nh_helpers', () => ({
  NH_colors: { '8_9': 'green' },
  getNHVocab: jest.fn().mockResolvedValue({
    '8_9': { feelings: { happy: 1 } },
  }),
}));

jest.mock('../config/srs_cards', () => ({
  getSRSCard: jest.fn((set, index) => {
    if (set === 'h' && index === 0) return { word: 'ship' };
    return null;
  }),
}));

jest.mock('../public/vocabulary.js', () => ([
  { id: 1, word: 'dog', meaning: 'inu', image: 'dog.svg', audio: 'dog.mp3' },
  { id: 2, word: 'cat', meaning: 'neko', image: 'cat.svg', audio: 'cat.mp3' },
]));

describe('Main Router', () => {
  let app;
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    app = express();
    app.use(express.json());
    // Mock i18n helper req.__
    app.use((req, res, next) => {
      req.__ = (str) => `translated_${str}`;
      next();
    });
    app.set('view engine', 'ejs');
    app.render = jest.fn((view, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      cb(null, `Mocked ${view} content`);
    });
    app.use('/', router);
    app.use((err, req, res, next) => {
      res.status(err.status || 500).send(err.message || 'Error');
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Static & Redirect routes', () => {
    test('GET / redirects to /abc', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/abc');
    });

    test('GET /abc redirects to /letters', async () => {
      const response = await request(app).get('/abc');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/letters');
    });

    test('GET /shapes redirects to /things/shapes', async () => {
      const response = await request(app).get('/shapes');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/things/shapes');
    });

    test('GET /speech redirects to /things/colors', async () => {
      const response = await request(app).get('/speech');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/things/colors');
    });

    test('GET /New_Horizons redirects to /NH', async () => {
      const response = await request(app).get('/New_Horizons');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/NH');
    });

    test('GET /multiplayer redirects to /lobby', async () => {
      const response = await request(app).get('/multiplayer');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/lobby');
    });

    test('GET /multiplayer/race redirects to /lobby/race', async () => {
      const response = await request(app).get('/multiplayer/race');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/lobby/race');
    });
  });

  describe('SRS Card Loader', () => {
    test('GET /SRS/loadcard returns card data for valid query', async () => {
      const response = await request(app).get('/SRS/loadcard?set=h&card=0');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ word: 'ship' });
    });

    test('GET /SRS/loadcard returns 404 for invalid card/set', async () => {
      const response = await request(app).get('/SRS/loadcard?set=invalid&card=0');
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Card not found');
    });
  });



  describe('Page Rendering', () => {
    test('GET /NH renders students/NH', async () => {
      const response = await request(app).get('/NH');
      expect(response.status).toBe(200);
      expect(app.render).toHaveBeenCalledWith('students/NH', expect.any(Object), expect.any(Function));
    });

    test('GET /slots renders activities/slots', async () => {
      const response = await request(app).get('/slots');
      expect(response.status).toBe(200);
      expect(app.render).toHaveBeenCalledWith('activities/slots', expect.any(Object), expect.any(Function));
    });

    test('GET /speak_spell renders activities/speak_spell', async () => {
      const response = await request(app).get('/speak_spell');
      expect(response.status).toBe(200);
      expect(app.render).toHaveBeenCalledWith('activities/speak_spell', expect.any(Object), expect.any(Function));
    });

    test('GET /interview renders activities/interview with book pages', async () => {
      fs.readdir.mockImplementation((path, cb) => {
        cb(null, ['page1.png', 'page2.png']);
      });

      const response = await request(app).get('/interview?page=page1.png');
      expect(response.status).toBe(200);
      expect(app.render).toHaveBeenCalledWith('activities/interview', expect.objectContaining({
        page: 'page1.png',
        pages: ['page1.png', 'page2.png'],
      }), expect.any(Function));
    });
  });

  describe('Legacy and Catch-all redirects', () => {
    test('POST /:activity redirects vocab activities to /vocab/:activity', async () => {
      const response = await request(app).post('/flash');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/vocab/flash');
    });

    test('POST /:activity redirects tools activities to /tools/:activity', async () => {
      const response = await request(app).post('/richtext');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/tools/richtext');
    });

    test('GET /:activity/:id redirects valid vocab activities to /vocab/:activity/:id', async () => {
      const response = await request(app).get('/match/123');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/vocab/match/123');
    });

    test('GET /:activity/:id returns 404 for unknown activity', async () => {
      const response = await request(app).get('/unknown_activity/123');
      expect(response.status).toBe(404);
    });
  });
});
