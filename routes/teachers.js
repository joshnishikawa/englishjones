const express = require('express');
const router = express.Router();
const vocabulary = require('../public/vocabulary.js');
const db = require('../config/db.js');
const { NH_colors, getNHVocab } = require('../config/nh_helpers.js');
const text_decks = require('../public/javascripts/text_decks.json');
const multiplayer = require('./multiplayer');

router.use('/lobby', multiplayer);

router.get('/multiplayer', (req, res)=>{
  try{
    res.redirect('/teachers/lobby');
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});

router.get('/multiplayer/:activity', (req, res)=>{
  try{
    res.redirect(`/teachers/lobby/${encodeURIComponent(req.params.activity)}`);
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/', (req, res)=>{
  try{
    res.redirect('/teachers/NH');
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/images', (req, res)=>{
  try{
    res.render('teachers/images');
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/LT', async (req, res)=>{
  try{
    let rows = vocabulary.filter(item => item.book === 'LT');
    let LT_vocab = {};
    for (let row of rows){
      if ( !LT_vocab[row.theme] ) LT_vocab[row.theme] = {};
      LT_vocab[row.theme][row.word] = row.id;
    }

    res.render('teachers/LT', {LT_vocab});
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/NH', async(req, res)=>{
  try{
    let NH_vocab = await getNHVocab();
    res.render('teachers/NH', {NH_vocab, colors: NH_colors});
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/text', (req, res)=>{
  try{
    res.render('teachers/text', {text_decks});
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});



// router.get('/dlpicdic', async(req, res)=>{
     // this is a one-time use route to download all the images from New Horizon
//   try{
//     let s = 1;

//     for (let i = 1; i <= 987; i++){
//       if ( [15, 54, 69, 80, 115, 152, 164, 179, 216, 222, 240, 251, 297, 334,
//             346, 360, 372, 386, 418, 427, 432, 442, 455, 464, 477, 556, 564,
//             568, 592, 613, 633, 693, 701, 706, 720, 732, 750, 760, 818, 841,
//             858, 870, 887, 915, 965].includes(i) ) s++;

//       let section = s.toString().padStart(2, '0');
//       let name = i.toString().padStart(4, '0');
//       let newfilepath = path.join(__dirname, `../public/image/picdic/${name}.png`);
//       let url = `https://sw31.tsho.jp/06pk/e/pd/w${section}/assets/${name}.png`;

//       await download(url, newfilepath);
//     }
//     console.log("Downloads Completed");
//     res.send('ok');
//   }
//   catch(err){
//     res.status(500).render('error');
//     console.error(err);
//   }
// });


module.exports = router;
