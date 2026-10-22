const request = require('supertest');
const app = require('../ej');

describe('i18n Locale Detection', () => {
  test('detects English when Accept-Language is en-US (with secondary ja)', async () => {
    const res = await request(app)
      .get('/api/nh-vocab')
      .set('Accept-Language', 'en-US,en;q=0.9,ja;q=0.8');
    expect(res.status).toBe(200);
    expect(res.body.translations.feelings).toBe('feelings');
  });

  test('detects English when Accept-Language is en-US without explicit generic en and secondary ja', async () => {
    const res = await request(app)
      .get('/api/nh-vocab')
      .set('Accept-Language', 'en-US,ja;q=0.9');
    expect(res.status).toBe(200);
    expect(res.body.translations.feelings).toBe('feelings');
  });

  test('detects English when Accept-Language is en-GB', async () => {
    const res = await request(app)
      .get('/api/nh-vocab')
      .set('Accept-Language', 'en-GB,en;q=0.8');
    expect(res.status).toBe(200);
    expect(res.body.translations.feelings).toBe('feelings');
  });

  test('detects Japanese when Accept-Language is ja-JP or ja', async () => {
    const res = await request(app)
      .get('/api/nh-vocab')
      .set('Accept-Language', 'ja-JP,ja;q=0.9,en;q=0.8');
    expect(res.status).toBe(200);
    expect(res.body.translations.feelings).toBe('気分');
  });

  test('allows query parameter ?lang=ja to override English headers', async () => {
    const res = await request(app)
      .get('/api/nh-vocab?lang=ja')
      .set('Accept-Language', 'en-US,en;q=0.9');
    expect(res.status).toBe(200);
    expect(res.body.translations.feelings).toBe('気分');
  });

  test('allows query parameter ?lang=en to override Japanese headers', async () => {
    const res = await request(app)
      .get('/api/nh-vocab?lang=en')
      .set('Accept-Language', 'ja,ja-JP;q=0.9');
    expect(res.status).toBe(200);
    expect(res.body.translations.feelings).toBe('feelings');
  });
});
