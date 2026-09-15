const express = require('express');
const router = express.Router();
const hostedRouter = express.Router();
const activities = require('../config/multiplayer_activities.js');

const enabledActivities = activities.filter((activity) => activity.enabled);
const enabledHostedActivities = activities.filter((activity) => activity.enabled && activity.group === 'host');

router.get('/', (req, res) => {
  try {
    const isTeacher = Boolean(
      (req.baseUrl && req.baseUrl.startsWith('/teachers')) ||
      (req.originalUrl && req.originalUrl.startsWith('/teachers')) ||
      (req.query && (req.query.teacher === '1' || req.query.teacher === 'true'))
    );
    res.render('lobby/lobby', { activities: enabledActivities, isTeacher, teacher: isTeacher });
  } catch (err) {
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});

router.get('/:activity', (req, res, next) => {
  const activity = enabledActivities.find((a) => a.id === req.params.activity);
  if (!activity) {
    return next();
  }
  const groupDir = activity.group === 'host' ? 'hosted' : 'multiplayer';
  try {
    res.render(`lobby/${groupDir}/${activity.id}/index`);
  } catch (err) {
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});

hostedRouter.get('/:activity', (req, res, next) => {
  const activity = enabledHostedActivities.find((a) => a.id === req.params.activity);
  if (!activity) {
    return next();
  }
  try {
    res.render(`lobby/hosted/${activity.id}/index`);
  } catch (err) {
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});

router.hostedRouter = hostedRouter;
router.router = router;

module.exports = router;
