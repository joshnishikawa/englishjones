const express = require('express');
const request = require('supertest');
const router = require('../routes/things');

describe('Things Router', () => {
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
    app.use('/things', router);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('GET /things', () => {
    test('should render students/things', async () => {
      const response = await request(app).get('/things');
      expect(response.status).toBe(200);
      expect(app.render).toHaveBeenCalledWith('students/things', expect.any(Object), expect.any(Function));
    });

    test('should handle render errors gracefully', async () => {
      renderError = true;
      const response = await request(app).get('/things');
      expect(response.status).toBe(500);
      expect(app.render).toHaveBeenCalledWith('error', expect.any(Object), expect.any(Function));
    });
  });

  describe('GET /things/dressup/:type', () => {
    test('should render dressup_boy.ejs for valid type boy', async () => {
      const response = await request(app).get('/things/dressup/boy');
      expect(response.status).toBe(200);
      expect(app.render).toHaveBeenCalledWith('activities/things/dressup_boy.ejs', expect.any(Object), expect.any(Function));
    });

    test('should render dressup_girl.ejs for valid type girl', async () => {
      const response = await request(app).get('/things/dressup/girl');
      expect(response.status).toBe(200);
      expect(app.render).toHaveBeenCalledWith('activities/things/dressup_girl.ejs', expect.any(Object), expect.any(Function));
    });

    test('should render 404 view for invalid dressup type', async () => {
      const response = await request(app).get('/things/dressup/invalid');
      expect(response.status).toBe(200);
      expect(app.render).toHaveBeenCalledWith('404', expect.any(Object), expect.any(Function));
    });
  });

  describe('GET /things/:activity', () => {
    const validActivities = ['room', 'shapes', 'colors', 'supplies', 'snake', 'directions'];

    validActivities.forEach(activity => {
      test(`should render activities/things/${activity} for valid activity`, async () => {
        const response = await request(app).get(`/things/${activity}`);
        expect(response.status).toBe(200);
        expect(app.render).toHaveBeenCalledWith(`activities/things/${activity}`, expect.any(Object), expect.any(Function));
      });
    });

    test('should redirect /things/map to /things/directions', async () => {
      const response = await request(app).get('/things/map');
      expect(response.status).toBe(302);
      expect(response.header.location).toBe('/things/directions');
    });

    test('should return 500/error on invalid activity name', async () => {
      const response = await request(app).get('/things/unknown_activity');
      expect(response.status).toBe(500);
      expect(app.render).toHaveBeenCalledWith('error', expect.any(Object), expect.any(Function));
    });
  });
});
