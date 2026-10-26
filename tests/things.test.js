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
    const validActivities = ['room', 'shapes', 'colors', 'supplies', 'snake', 'town', 'school'];

    validActivities.forEach(activity => {
      test(`should render activities/things/${activity} for valid activity`, async () => {
        const response = await request(app).get(`/things/${activity}`);
        expect(response.status).toBe(200);
        expect(app.render).toHaveBeenCalledWith(`activities/things/${activity}`, expect.any(Object), expect.any(Function));
      });
    });

    test('should redirect /things/map to /things/town', async () => {
      const response = await request(app).get('/things/map');
      expect(response.status).toBe(302);
      expect(response.header.location).toBe('/things/town');
    });

    test('should return 500/error on invalid activity name', async () => {
      const response = await request(app).get('/things/unknown_activity');
      expect(response.status).toBe(500);
      expect(app.render).toHaveBeenCalledWith('error', expect.any(Object), expect.any(Function));
    });
  });

  describe('Real EJS Template Rendering for Supplies and Directions', () => {
    let realApp;
    const path = require('path');

    beforeAll(() => {
      realApp = express();
      realApp.set('view engine', 'ejs');
      realApp.set('views', path.join(__dirname, '../views'));
      realApp.use((req, res, next) => {
        res.locals.__ = (key) => key;
        res.locals.user = null;
        res.locals.isAuthenticated = false;
        next();
      });
      realApp.use('/things', router);
    });

    test('renders supplies template with all 12 supplies and canvas elements', async () => {
      const res = await request(realApp).get('/things/supplies');
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="supplyMenu"');
      expect(res.text).toContain('id="canvas"');
      expect(res.text).toContain('id="canvasWrapper"');
      expect(res.text).toContain('data-shape="stapler"');
      expect(res.text).toContain('data-shape="pencilcase"');
      expect(res.text).toContain('data-shape="scissors"');
      expect(res.text).toContain('data-shape="calendar"');
      expect(res.text).toContain('data-shape="eraser"');
      expect(res.text).toContain('data-shape="glue"');
      expect(res.text).toContain('data-shape="marker"');
      expect(res.text).toContain('data-shape="notebook"');
      expect(res.text).toContain('data-shape="pen"');
      expect(res.text).toContain('data-shape="pencil"');
      expect(res.text).toContain('data-shape="ruler"');
      expect(res.text).toContain('data-shape="sharpener"');
    });

    test('renders town directions template with board, street markings, and mover', async () => {
      const res = await request(realApp).get('/things/town');
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="directionsBoard"');
      expect(res.text).toContain('id="streetLinesSvg"');
      expect(res.text).toContain('id="moverAvatar"');
      expect(res.text).toContain('id="listen"');
      expect(res.text).toContain('id="stop"');
    });

    test('renders school directions template with rooms grid and mover', async () => {
      const res = await request(realApp).get('/things/school');
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="directionsBoard"');
      expect(res.text).toContain('id="roomsGrid"');
      expect(res.text).toContain('id="moverAvatar"');
      expect(res.text).toContain('id="listen"');
      expect(res.text).toContain('id="stop"');
    });
  });
});

