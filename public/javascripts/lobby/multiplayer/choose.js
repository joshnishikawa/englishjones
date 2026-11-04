/**
 * lobby/multiplayer/choose.js — "Choose" multiplayer activity (client)
 * ──────────────────────────────────────────────────────────────────────
 * Flow:
 *   1. mount() is called by the multiplayer framework with {socket, player, room}.
 *   2. Client emits 'choose/playerready'; server waits for all players.
 *   3. Server sends 'choose/roundstart' with items[] and a chooserNumber.
 *   4. The chooser uses Web Speech API to say a word; an image is selected.
 *   5. Guessers tap the matching word; server tallies, emits 'choose/reveal'.
 *   6. After all rounds, 'choose/gameover' fires, chooser emits 'activityComplete'.
 *
 * Roles:
 *   - Chooser: sees images, speaks to select one, waits for guesses.
 *   - Guesser: sees a quick slideshow preview, then picks a word after selection.
 *
 * Pattern: IIFE → registers on window.multiplayerActivities.choose = { mount, teardown }.
 *          Uses jQuery for DOM, Socket.IO for transport, Web Speech API for input.
 */
(function() {
  /* ── Module-level state (reset on every mount) ── */
  let selectedWord = null;      // The word the chooser spoke / picked
  let roundItems = [];           // Array of {word, image} for this round
  let chooserNumber = null;      // Player number of the current chooser
  let hasSubmittedWord = false;  // Whether this guesser already submitted
  let currentPlayer = null;      // Player object passed in at mount
  let currentSocket = null;      // Socket.IO socket passed in at mount
  let slideshowTimer = null;     // setInterval id for guesser image preview
  let slideshowIndex = 0;        // Current frame in the slideshow
  let recognition = null;        // SpeechRecognition instance
  let speechSupported = false;   // Whether the browser supports Web Speech API
  let isListening = false;       // Whether recognition.start() is active
  let listenersAttached = false; // Guard to prevent double-attaching socket listeners

  /* ── Helpers ── */

  /** True if this client is the chooser (speaker) for the current round. */
  function isChooser() {
    return Number(currentPlayer.number) === Number(chooserNumber);
  }

  /** Strip to lowercase alpha + spaces for fuzzy speech matching. */
  function normalize(text) {
    return (text || '').toLowerCase().replace(/[^a-z\s]/g, '').trim();
  }

  /** Look up the image filename for a given word in the current round. */
  function getImageForWord(word) {
    for (let i = 0; i < roundItems.length; i++) {
      if (roundItems[i].word === word) return roundItems[i].image;
    }
    return null;
  }

  /**
   * Attempt to match a speech transcript to one of the round's words.
   * Tries exact match first, then substring containment in either direction.
   */
  function findRecognizedWord(transcript) {
    const spoken = normalize(transcript);
    if (!spoken) return null;

    const exact = roundItems.find((item) => normalize(item.word) === spoken);
    if (exact) return exact.word;

    const included = roundItems.find((item) => {
      const w = normalize(item.word);
      return spoken.includes(w) || w.includes(spoken);
    });
    if (included) return included.word;

    return null;
  }

  /* ── UI helpers ── */

  /** Update the status banner text. */
  function setStatus(text) {
    $('#choose-status').text(text);
  }

  /** Enable/disable the speak/listen buttons and update mic animation states. */
  function setSpeakButtonState(enabled, label) {
    const $listenBtn = $('#choose-listen-btn, #choose-speak-btn');
    const $stopBtn = $('#choose-stop-btn');

    if (isListening) {
      $listenBtn.addClass('mic-listening btn-success').removeClass('btn-outline-success').prop('disabled', true);
      $stopBtn.prop('disabled', false).addClass('btn-danger').removeClass('btn-secondary');
    } else {
      $listenBtn.removeClass('mic-listening').prop('disabled', !enabled);
      $stopBtn.prop('disabled', true).removeClass('btn-danger').addClass('btn-secondary');
    }

    if (label !== undefined && label !== null) {
      $('#choose-heard').text(label);
    }
  }

  /* ── Speech Recognition lifecycle ── */

  /** Start the speech recognizer (chooser-only, user-initiated). */
  function beginListening() {
    if (!isChooser()) return;
    if (selectedWord) return;          // Already chose — no more listening
    if (!speechSupported || !recognition) return;
    if (isListening) return;           // Prevent double-start

    isListening = true;
    setSpeakButtonState(true, 'Listening...');
    recognition.start();
  }

  function hasRoundStarted() {
    return roundItems.length > 0;
  }

  function stopListening() {
    isListening = false;
    if (recognition) {
      recognition.stop();
    }
    setSpeakButtonState(true, '');
  }

  /**
   * Create and configure a SpeechController instance.
   */
  function initializeSpeech() {
    recognition = new SpeechController({
      unsupportedAlert: '#choose-unsupportedAlert',
      continuous: false,
      interimResults: false,
      maxAlternatives: 3,
      shouldRestart: () => isListening && isChooser() && !selectedWord,
      onStatusChange: (status) => {
        if (status === 'stopped' || status === 'error') {
          isListening = false;
          setSpeakButtonState(true, '');
        }
      },
      onResult: (transcript, alternatives, rawAlternatives) => {
        let recognizedWord = null;
        let heardText = rawAlternatives[0] || transcript;

        for (const raw of rawAlternatives) {
          recognizedWord = findRecognizedWord(raw);
          if (recognizedWord) {
            heardText = raw;
            break;
          }
        }

        $('#choose-heard').text('Heard: ' + heardText);
        if (!recognizedWord) {
          setStatus('Not recognized as an available word. Try again.');
          return true;
        }

        showSelectedImage(recognizedWord);
        currentSocket.emit('choose/selectimg', {
          roomname: currentPlayer.roomname,
          word: recognizedWord,
        });
        return true;
      }
    });

    speechSupported = recognition.isSupported;
    if (!speechSupported) {
      $('#choose-unsupportedAlert').show();
      $('#choose-listen-btn, #choose-stop-btn, #choose-speak-btn').prop('disabled', true);
    } else {
      $('#choose-unsupportedAlert').hide();
    }
  }

  /* ── Slideshow (guesser sees a fast preview of all images) ── */

  function stopSlideshow() {
    if (slideshowTimer) {
      clearInterval(slideshowTimer);
      slideshowTimer = null;
    }
    $('#choose-slideshow-container .choose-slide-img').addClass('d-none');
  }

  /** Cycle through pre-rendered round images locally without sending HTTP GET requests. */
  function startSlideshow() {
    stopSlideshow();
    const $slides = $('#choose-slideshow-container .choose-slide-img');
    if (!$slides.length) return;

    slideshowIndex = 0;
    $slides.eq(0).removeClass('d-none');

    slideshowTimer = setInterval(function() {
      $slides.eq(slideshowIndex).addClass('d-none');
      slideshowIndex = (slideshowIndex + 1) % $slides.length;
      $slides.eq(slideshowIndex).removeClass('d-none');
    }, 220);
  }

  /** Toggle between chooser and guesser UI panels. */
  function setRoleView() {
    if (isChooser()) {
      stopSlideshow();
      $('#choose-chooser-panel').removeClass('d-none');
      $('#choose-guesser-panel').addClass('d-none');
      if (selectedWord) {
        setSpeakButtonState(false, 'Word Selected');
      } else if (speechSupported) {
        setSpeakButtonState(true, '');
      }
    } else {
      stopListening();
      $('#choose-chooser-panel').addClass('d-none');
      $('#choose-guesser-panel').removeClass('d-none');
    }
  }

  /** Clean up all DOM handlers and socket listeners for this activity. */
  function teardown(socket) {
    stopSlideshow();
    stopListening();
    if (recognition) {
      recognition.destroy();
      recognition = null;
    }
    if (!listenersAttached) return;
    $('#choose-listen-btn, #choose-stop-btn, #choose-speak-btn').off('click');
    socket.off('choose/waiting');
    socket.off('choose/roundstart');
    socket.off('choose/imageselected');
    socket.off('choose/guesscount');
    socket.off('choose/reveal');
    socket.off('choose/gameover');
    listenersAttached = false;
  }

  /**
   * Display the selected image prominently and hide the rest.
   */
  function showSelectedImage(word) {
    selectedWord = word;
    const imageName = getImageForWord(word);
    stopSlideshow();
    stopListening();

    $('#choose-images img').addClass('thumb').hide();
    $('#choose-images img').filter(function() {
      return $(this).attr('alt') === word;
    }).removeClass('thumb').show();

    if (imageName) {
      $('#choose-selected-preview')
        .attr('src', '/image/LT/' + imageName)
        .removeClass('d-none');
    }

    if (isChooser()) {
      setSpeakButtonState(false, 'Word Selected');
      setStatus('Waiting for guesses...');
    } else {
      setStatus('Pick the matching word.');
    }
  }

  /* ── Board rendering ── */

  /** Build the image grid and word buttons for a new round. */
  function renderBoard() {
    const $images = $('#choose-images');
    const $words = $('#choose-words');
    const $slideshowContainer = $('#choose-slideshow-container');

    $images.empty();
    $words.empty();
    $slideshowContainer.empty();
    $('#choose-selected-preview').addClass('d-none').attr('src', '');

    setRoleView();

    for (let i = 0; i < roundItems.length; i++) {
      const item = roundItems[i];
      const img = $('<img>', {
        src: '/image/LT/' + item.image,
        class: 'img-fluid thumb me-1 mb-1 choose-image',
        alt: item.word,
      });

      // Fall back to altOnly() (from script.js global) on broken images
      img.on('error', function() {
        if (typeof altOnly === 'function') {
          altOnly(this);
        }
      });

      // Clicking image as chooser just reminds to use speech; guessers are ignored
      img.on('click', function() {
        if (!isChooser()) return;
        if (selectedWord) return;
        setStatus('Use Start button and say a word.');
      });

      $images.append(img);

      // Pre-render slideshow images into DOM so cycling triggers zero HTTP GET requests
      const slideImg = $('<img>', {
        src: '/image/LT/' + item.image,
        class: 'img-fluid choose-slide-img d-none',
        alt: item.word,
      });
      slideImg.on('error', function() {
        if (typeof altOnly === 'function') {
          altOnly(this);
        }
      });
      $slideshowContainer.append(slideImg);

      const word = $('<div>', {
        class: 'col-4 choose-word py-1',
        text: item.word,
      });

      // Guesser taps a word → submit guess to server (one attempt only)
      word.on('click', function() {
        if (isChooser()) return;                     // Chooser can't guess
        if (!selectedWord || hasSubmittedWord) return; // Wait / already guessed

        hasSubmittedWord = true;
        $('#choose-words .choose-word').addClass('choose-word-disabled');
        $(this).addClass('choose-word-selected');
        currentSocket.emit('choose/selectword', {
          roomname: currentPlayer.roomname,
          word: item.word,
        });
        setStatus('Answer submitted. Waiting for others...');
      });

      $words.append(word);
    }

    if (isChooser()) {
      $('#choose-words .choose-word').addClass('choose-word-disabled');
      if (speechSupported) {
        setStatus('Your turn: tap Start to speak.');
        setSpeakButtonState(true, '');
      } else {
        setStatus('Speech recognition unavailable on this device/browser.');
        setSpeakButtonState(false, 'Speech Not Supported');
      }
    } else {
      startSlideshow();
      setStatus('Wait for the active player to choose an image, then choose a word.');
    }
  }

  /* ── Mount / Teardown (lifecycle managed by multiplayer framework) ── */

  /**
   * Initialize the Choose activity.
   * Called by the multiplayer framework when this activity is selected.
   * Resets all state, sets up speech, DOM handlers, and socket listeners.
   */
  function mount(options) {
    const socket = options.socket;
    const player = options.player;
    const room = options.room;

    teardown(socket);  // Clean up any previous session

    currentSocket = socket;
    currentPlayer = player;
    roundItems = [];
    chooserNumber = null;
    selectedWord = null;
    hasSubmittedWord = false;
    speechSupported = false;
    recognition = null;
    isListening = false;

    $('#choose-images').empty();
    $('#choose-words').empty();
    $('#choose-heard').text('');

    setStatus('Waiting for all players to load Choose...');

    initializeSpeech();

    $('#choose-listen-btn, #choose-speak-btn').off('click').on('click', function() {
      beginListening();
    });

    $('#choose-stop-btn').off('click').on('click', function() {
      stopListening();
    });

    /* ── Socket event handlers ── */

    // Server reports how many players are ready in the lobby
    socket.on('choose/waiting', function(data) {
      if (hasRoundStarted()) return; // Ignore late lobby messages
      if (data.ready >= data.expected) {
        setStatus('All players ready. Starting round...');
        return;
      }
      setStatus('Waiting for players: ' + data.ready + '/' + data.expected);
    });

    // New round: receive items and which player is the chooser
    socket.on('choose/roundstart', function(data) {
      roundItems = data.items || [];
      chooserNumber = data.chooserNumber;
      selectedWord = null;
      hasSubmittedWord = false;
      renderBoard();
    });

    // Broadcast: the chooser selected an image — show it to all
    socket.on('choose/imageselected', function(data) {
      showSelectedImage(data.word);
    });

    // Server reports how many guessers have submitted
    socket.on('choose/guesscount', function(data) {
      if (isChooser()) {
        setStatus('Guesses: ' + data.guessed + '/' + data.expected);
      }
    });

    // Reveal correct answer + mark each guesser's pick as correct/incorrect
    socket.on('choose/reveal', function(data) {
      const correctWord = data.correctWord;
      $('#choose-words .choose-word').removeClass('choose-word-selected choose-word-correct choose-word-incorrect choose-word-disabled');

      $('#choose-words .choose-word').filter(function() {
        return $(this).text() === correctWord;
      }).addClass('choose-word-correct');

      for (let i = 0; i < data.results.length; i++) {
        const result = data.results[i];
        if (!result.correct) {
          $('#choose-words .choose-word').filter(function() {
            return $(this).text() === result.word;
          }).addClass('choose-word-incorrect');
        }
      }

      setStatus('Answer: ' + correctWord);
    });

    // All rounds done — chooser tells server the activity is finished
    socket.on('choose/gameover', function() {
      setStatus('Round complete. Starting over...');
      if (isChooser()) {
        socket.emit('activityComplete', {
          roomname: player.roomname,
          activity: 'choose',
        });
      }
    });

    // Tell the server this player is ready to begin
    socket.emit('choose/playerready', {
      roomname: player.roomname,
      playerId: player.id,
      playerNumber: player.number,
      totalPlayers: room && room.players ? room.players.length : 0,
    });

    listenersAttached = true;
  }

  /* ── Register with the multiplayer activity registry ── */
  window.multiplayerActivities = window.multiplayerActivities || {};
  window.multiplayerActivities.choose = {
    mount: mount,
    teardown: teardown
  };
})();
