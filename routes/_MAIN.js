const express = require('express');
const router = express.Router();
const createError = require('http-errors');
const fs = require('fs');
const path = require('path');
const letters = require('./letters.js');
const things = require('./things.js');
const vocab = require('./vocab.js');
const tools = require('./tools.js');
const labs = require('./labs.js');
const lobby = require('./lobby.js');
const db = require('../config/db.js');
const { NH_colors, getNHVocab } = require('../config/nh_helpers.js');
const { getSRSCard } = require('../config/srs_cards.js');

router.use('/letters', letters);
router.use('/things', things);
router.use('/vocab', vocab);
router.use('/tools', tools);
router.use('/labs', labs.router);
router.use('/lobby', lobby);
router.use('/hosted', lobby.hostedRouter);


router.get('/SRS/loadcard', (req, res) => {
  try {
    let set = req.query.set;
    let cardIndex = parseInt(req.query.card, 10);
    if (isNaN(cardIndex)) cardIndex = 0;

    let cardData = getSRSCard(set, cardIndex);
    if (!cardData) {
      return res.status(404).json({ error: 'Card not found' });
    }
    res.json(cardData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


router.get('/', (req, res)=>{
  try{
    res.redirect('/abc');
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/LT1', (req, res)=>{
  try{
    res.sendFile(path.join(__dirname, '../public/LT1/index.html'));
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/LT2', (req, res)=>{
  try{
    res.sendFile(path.join(__dirname, '../public/LT2/index.html'));
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});




router.get('/NH', async (req, res)=>{
  try{
    let NH_vocab = await getNHVocab();
    res.render('students/NH', {NH_vocab, NH_colors, colors: NH_colors, teacher: false});
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/slots', (req, res)=>{ 
  try{
    res.render('activities/slots');
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/interview', (req, res)=>{
  try{
    const validBooks = ['brainbox', 'honto1', 'honto2', 'honto3'];
    let book = validBooks.includes(req.query.book) ? req.query.book : 'brainbox';
    let page = req.query.page ?? 'airport.png';

    fs.readdir( path.join(__dirname, `../public/image/interview/${book}`), (err, pages)=>{
      if (err) throw err;
      res.render('activities/interview', {book, pages, page});
    });
  }
  catch(err){ console.error(err); }
});


router.get('/shapes', (req, res)=>{ // moved to things
  try{
    res.redirect('/things/shapes');
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/speech', (req, res)=>{
  try{
    res.redirect('/things/colors');
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/speak_spell', (req, res)=>{
  try{
    res.render('activities/speak_spell');
  }
  catch
  (err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


// Redirects for edprecated routes /////////////////////////////////////////////

router.get('/New_Horizons', (req, res)=>{ // Because you borked it dude!
  try{
    res.redirect('/NH');
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/abc', (req, res)=>{
  try{
    res.redirect('/letters');
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/multiplayer', (req, res)=>{
  try{
    res.redirect('/lobby');
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/multiplayer/:activity', (req, res)=>{
  try{
    res.redirect(`/lobby/${encodeURIComponent(req.params.activity)}`);
  }
  catch(err){
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.post('/:activity', async(req, res)=>{
  try{
    if ( ["bingo", "flash", "grid", "match", "recall", "reveal", "type", "spell", "penmanship", "printcards", "double", "write"].includes(req.params.activity) ){
      res.redirect(`/vocab/${req.params.activity}`);
    }
    else if ( ["richtext", "names", "lp", "interview"].includes(req.params.activity) ){
      res.redirect(`/tools/${req.params.activity}`);
    }
    else{
      throw '404';
    }
  }
  catch(err){
    if (err == '404') return res.status(404).render('404');
    res.status(500).render('error', { message: err.message || String(err), error: err });
    console.error(err);
  }
});


router.get('/:activity/:id', async(req, res, next)=>{
  try{
    console.log(req.params.activity);
    if ( ["bingo", "flash", "grid", "match", "recall", "reveal", "type", "spell", "penmanship", "printcards", "double", "write"].includes(req.params.activity) ){
      res.redirect(`/vocab/${req.params.activity}/${req.params.id}`);
    }
    else {
      console.log('404 redirect failed for activity:', req.params.activity);
      return next(createError(404));
    }
  }
  catch(err){
    next(err);
  }
});


module.exports = router;
