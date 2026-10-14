//"use strict";
require('dotenv').config();
const monitor = require('/var/www/assets/monitor')({ site: 'dev.share' });
monitor.catchGlobals();
const express = require('express');
const app = express();
const server = require('http').createServer(app);

const socket_io = require('socket.io')(server);
const multiplayer = require('./lobby/lobby.js');
multiplayer(socket_io);

const createError = require('http-errors');
const helmet = require('helmet');
const logger = require('morgan');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const mysql = require('mysql2/promise');
const passport = require('passport');

const mainRouter = require('./routes/_MAIN.js');
const TRouter = require('./routes/teachers.js');
const mediaRouter = require('./routes/media.js');
const authRouter = require('./routes/auth.js');
const apiRouter = require('./routes/api.js');

const { I18n } = require('i18n');
const i18n = new I18n({
  locales: ['en', 'ja'],
  fallbacks: { 'en-*': 'en', 'ja-*': 'ja' },
  defaultLocale: 'en',
  cookie: 'lang',
  queryParameter: 'lang',
  directory: path.join(__dirname, 'locales'),
  retryInDefaultLocale: true,
  objectNotation: true,
  autoReload: true
});

// Session store configuration
const dbPool = require('./config/db.js');
const sessionStore = new MySQLStore({
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, dbPool.pool); // .pool accesses the underlying non-promise pool

// Passport configuration
require('./config/passport.js')(passport);


const port = process.env.PORT;
if (process.env.NODE_ENV !== 'test') {
  server.listen(port, (err)=>{
    if(err) {
      console.error(err);
      return;
    }
    console.log('Listening on port: ', port);
  });
}

// SET VIEW ENGINE /////////////////////////////////////////////////////////////
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// PROCESS USER REQUESTS *IN ORDER* ////////////////////////////////////////////
app.use(helmet({
  contentSecurityPolicy: false, // Disabled — requires nonce-based CSP across all views
  referrerPolicy: { policy: 'same-origin' } // Allow Referer on same-origin requests (needed for OAuth returnTo)
}));
app.use( logger('dev') );
app.use( express.json({ limit: '5mb' }) );
app.use( express.urlencoded({ extended: false }) );
app.use(  express.static( path.join(__dirname, 'public'), {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
  }
}) );

// Trust proxy for secure cookies behind reverse proxy
app.set('trust proxy', 1);

// Security: Enforce SESSION_SECRET in production
if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable must be set');
  process.exit(1);
}

// Session configuration
app.use(session({
  key: 'session_cookie',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: true, // Must be true to save returnTo before OAuth
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    secure: 'auto', // Auto-detect based on connection (works with proxies)
    sameSite: 'lax' // Allow cookies to be sent during OAuth redirects
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Make user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  res.locals.message = '';
  res.locals.error = {};
  next();
});

// Capture direct res.render('error') calls that bypass next(err) so monitor can alert Discord
app.use((req, res, next) => {
  const originalRender = res.render;
  res.render = function(view, options, callback) {
    if (view === 'error' && (res.statusCode >= 500 || !res.statusCode)) {
      if (!req._monitorAlertSent) {
        req._monitorAlertSent = true;
        const errObj = options?.error || (options instanceof Error ? options : null);
        const errMsg = options?.message || (typeof options === 'string' ? options : null) || errObj?.message || 'Internal Server Error';
        const errStack = errObj?.stack || (new Error().stack);
        monitor.sendAlert({
          title: `${res.statusCode || 500} ${errObj?.name || 'Application Error'}`,
          message: errMsg,
          stack: errStack,
          req
        });
      }
    }
    return originalRender.call(this, view, options, callback);
  };
  next();
});

// Parse cookies for i18n if req.cookies is not populated
app.use((req, res, next) => {
  if (!req.cookies && req.headers.cookie) {
    req.cookies = {};
    req.headers.cookie.split(';').forEach(c => {
      const parts = c.trim().split('=');
      if (parts[0] && parts[1]) req.cookies[parts[0]] = decodeURIComponent(parts[1]);
    });
  }
  // Persist language to cookie if ?lang= is passed
  if (req.query.lang && ['en', 'ja'].includes(req.query.lang)) {
    res.cookie('lang', req.query.lang, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax', path: '/' });
  }
  next();
});
app.use( i18n.init );
app.use((req, res, next) => {
  console.log(`[REQ-LOCALE] ${req.method} ${req.url} | Accept-Language: "${req.headers['accept-language']}" | Cookie: "${req.headers.cookie}" | Resolved: "${req.locale}"`);
  next();
});
app.use('/auth', authRouter);
app.use('/api', apiRouter);
app.use('/teachers', TRouter);
app.use('/media', mediaRouter);
app.use('/', mainRouter);

app.use( (req, res, next)=> { next(createError(404)); });

// Error monitoring middleware
app.use((err, req, res, next) => {
  req._monitorAlertSent = true;
  return monitor.errorHandler(err, req, res, next);
});

app.use( (err, req, res, next)=> {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  // render the error page
  res.status(err.status || 500);
  if (err.status === 404) res.render('404');
  else res.render('error');
  return;
});

module.exports = app;
