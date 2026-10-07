const express = require('express');
const router = express.Router();

router.get('/', (req, res)=>{
  try{
    res.render('students/things');
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/dressup/:type', (req, res)=>{
  try{
    const validTypes = ['boy', 'girl'];
    if (!validTypes.includes(req.params.type)) return res.render('404');
    res.render(`activities/things/dressup_${req.params.type}.ejs`);
  }
  catch(err){
    console.error(err);
    res.status(500).render('error', { message: err.message || String(err), error: err });
  }
});


router.get('/:activity', (req, res)=>{
  try{
    if (req.params.activity === 'map') {
      return res.redirect('/things/directions');
    }
    if ( !["room", "shapes", "colors", "supplies", "snake", "directions"].includes(req.params.activity) ){
      throw '404';
    }

    res.render(`activities/things/${req.params.activity}`);
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});

module.exports = router;
