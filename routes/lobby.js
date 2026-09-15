const express = require('express');
const router = express.Router();
const activities = require('../../config/multiplayer_activities.js');

const enabledActivities = activities.filter((activity) => activity.enabled);

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

module.exports = router;
