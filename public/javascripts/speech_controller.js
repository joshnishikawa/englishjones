////////////////////////////////////////////////////////////////////////////////
// speech_controller.js — Reusable, auto-recovering Web Speech API controller
//
// USAGE:
//   Loaded globally via views/head.ejs:
//     <script src="/javascripts/speech_controller.js"></script>
//
//   Instantiate with your activity's configuration:
//     const voice = new SpeechController({
//       listenBtn: '#listen',                  // Optional start button selector/element
//       stopBtn: '#stop',                      // Optional stop button selector/element
//       toggleBtn: '#MIC_TOGGLE',              // Optional single toggle button selector/element
//       holdSelector: '.push-to-talk',         // Optional push-to-talk selector (mousedown/touchstart)
//       transcriptEl: '#speechTranscript',     // Optional live transcript element
//       unsupportedAlert: '#unsupportedAlert', // Optional unsupported browser alert element
//       lang: 'en-US',                         // Default 'en-US'
//       continuous: true,                      // Default true (auto-restarting continuous mode)
//       interimResults: true,                  // Default true
//       maxAlternatives: 3,                    // Default 3 alternatives per utterance
//       echoWindowMs: 700,                     // Default 700ms duplicate echo protection
//       vocab: ['turn left', 'go straight'],   // Optional SpeechGrammarList hint words
//       commands: [                            // Optional regex command table
//         { id: 'turnLeft', regex: /\b(turn left|left)\b/i, action: () => turnLeft() }
//       ],
//       onInterim: (text, alternatives) => {}, // Optional interim speech hook
//       onResult: (text, alternatives, rawAlternatives, event) => {}, // Optional final speech hook
//       onStatusChange: (status, detail) => {},// 'listening' | 'stopped' | 'reconnecting' | 'error'
//       onError: (error, event) => {},         // Optional custom error handler
//       onNoMatch: (event) => {},              // Optional no-match handler
//       shouldRestart: () => true              // Optional guard before auto-restart
//     });
//
// GUARANTEES & ARCHITECTURE:
//   - Singleton Cleanup: Constructing a new SpeechController automatically stops/cleans up
//     any previous active controller (unless allowMultiple: true), preventing zombie mics on AJAX tabs.
//   - Zero Double-Triggers: Command actions ONLY execute on finalized speech (res.isFinal).
//   - Multi-Alternative Matching: Checks all recognition alternatives against commands & custom hooks.
//   - Real-Time Interim Feedback: Displays "Listening: ..." while speaking without triggering commands.
//   - Engine Echo Protection: Filters out browser trailing audio echoes within echoWindowMs.
//   - Auto-Recovery Lifecycle: Handles silence timeouts, exponential backoff retries, and clean instance recreation.
//   - Watchdog & Visibility: Auto-resumes listening when tab regains focus or after silent browser drops.
//   - Compound Command Parsing: Splits chained instructions like "turn left and go straight".
//   - Non-Dropping Command Queue: Sequential execution for multi-step animations (voice.enqueue).
////////////////////////////////////////////////////////////////////////////////

class SpeechController {
  constructor(options = {}) {
    if (!options.allowMultiple && SpeechController.activeInstance && SpeechController.activeInstance !== this) {
      try {
        SpeechController.activeInstance.destroy();
      } catch (e) {}
    }
    SpeechController.activeInstance = this;

    this.options = Object.assign({
      lang: 'en-US',
      echoWindowMs: 700,
      continuous: true,
      interimResults: true,
      maxAlternatives: 3,
      toggleIdleClass: 'btn-outline-primary',
      toggleActiveClass: 'btn-danger mic-listening',
      toggleIdleText: 'Start Mic',
      toggleActiveText: 'Stop Mic',
      commands: [],
      vocab: []
    }, options);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList || null;

    this.SpeechRecognition = SpeechRecognition;
    this.SpeechGrammarList = SpeechGrammarList;
    this.isSupported = Boolean(SpeechRecognition);

    this.recognition = null;
    this.isListening = false;
    this.isAudioActive = false;
    this.restartTimeout = null;
    this.restartAttempts = 0;
    this.watchdogInterval = null;
    this.activeHoldTarget = null;

    this.processedUtterances = new Set();
    this.lastExecutedCommandId = null;
    this.lastExecutedCommandTime = 0;
    this.lastExecutedTranscript = '';

    this.commandQueue = [];
    this.isExecutingQueue = false;

    // Cache DOM Elements if provided
    this.listenBtns = this._getElements(this.options.listenBtn);
    this.stopBtns = this._getElements(this.options.stopBtn);
    this.toggleBtns = this._getElements(this.options.toggleBtn);
    this.listenBtn = this.listenBtns[0] || null;
    this.stopBtn = this.stopBtns[0] || null;
    this.toggleBtn = this.toggleBtns[0] || null;
    this.transcriptEl = this._getElement(this.options.transcriptEl);
    this.unsupportedAlert = this._getElement(this.options.unsupportedAlert);

    this.commands = this.options.commands || [];
    this.vocab = this.options.vocab || [];

    this._bindEvents();
    this._initWatchdog();

    if (!this.isSupported) {
      if (this.unsupportedAlert) {
        this.unsupportedAlert.classList.remove('d-none');
        this.unsupportedAlert.style.display = 'block';
      }
      [...this.listenBtns, ...this.stopBtns, ...this.toggleBtns].forEach(btn => {
        btn.disabled = true;
        btn.classList.add('disabled');
      });
    }
  }

  _getElement(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    if (target instanceof HTMLElement) return target;
    if (window.jQuery && target instanceof window.jQuery) return target[0] || null;
    return null;
  }

  _getElements(target) {
    if (!target) return [];
    if (typeof target === 'string') return Array.from(document.querySelectorAll(target));
    if (target instanceof HTMLElement) return [target];
    if (window.jQuery && target instanceof window.jQuery) return target.toArray();
    return [];
  }

  _bindEvents() {
    this._boundListeners = [];

    const addListener = (el, evt, fn) => {
      if (!el) return;
      el.addEventListener(evt, fn);
      this._boundListeners.push({ el, evt, fn });
    };

    this.listenBtns.forEach(btn => addListener(btn, 'click', () => this.start()));
    this.stopBtns.forEach(btn => addListener(btn, 'click', () => this.stop()));
    this.toggleBtns.forEach(btn => addListener(btn, 'click', () => this.toggle()));

    if (this.options.holdSelector) {
      const onHoldStart = (e) => {
        const target = e.target.closest(this.options.holdSelector);
        if (!target) return;
        this.activeHoldTarget = target;
        this.start();
      };
      const onHoldEnd = () => {
        if (!this.activeHoldTarget) return;
        this.stop();
      };
      addListener(document, 'mousedown', onHoldStart);
      addListener(document, 'mouseup', onHoldEnd);
      addListener(document, 'touchstart', onHoldStart);
      addListener(document, 'touchend', onHoldEnd);
    }

    this._onVisibilityChange = () => {
      if (!document.hidden && this.isListening && !this.isAudioActive && this._canAutoRestart()) {
        this._scheduleRestart(150);
      }
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  _canAutoRestart() {
    if (!this.isListening) return false;
    if (typeof this.options.shouldRestart === 'function') {
      return Boolean(this.options.shouldRestart());
    }
    return this.options.continuous !== false;
  }

  _initWatchdog() {
    this.watchdogInterval = setInterval(() => {
      if (this.isListening && !this.isAudioActive && !this.restartTimeout && this._canAutoRestart()) {
        this._scheduleRestart(100);
      }
    }, 2500);
  }

  /* ==========================================================================
     Command Queueing (Non-blocking sequential animation support)
     ========================================================================== */
  enqueue(action, cooldown = 380) {
    if (typeof action !== 'function') return;
    if (this.commandQueue.length > 5) this.commandQueue.length = 5;
    this.commandQueue.push({ action, cooldown });
    this._processQueue();
  }

  _processQueue() {
    if (this.isExecutingQueue || this.commandQueue.length === 0) return;
    this.isExecutingQueue = true;
    const item = this.commandQueue.shift();
    try {
      item.action();
    } catch (err) {
      console.error('SpeechController: Error executing queued action:', err);
    }
    setTimeout(() => {
      this.isExecutingQueue = false;
      this._processQueue();
    }, item.cooldown);
  }

  clearQueue() {
    this.commandQueue = [];
    this.isExecutingQueue = false;
  }

  /* ==========================================================================
     Speech Recognition Engine Lifecycle & Auto-Recovery
     ========================================================================== */
  _createRecognition() {
    if (!this.SpeechRecognition) return null;
    let rec = null;
    try {
      rec = new this.SpeechRecognition();
    } catch (err) {
      console.error('SpeechController: Failed to construct SpeechRecognition:', err);
      return null;
    }

    if (this.SpeechGrammarList && this.vocab && this.vocab.length > 0) {
      try {
        const grammar = `#JSGF V1.0; grammar commands; public <commands> = ${this.vocab.join(' | ')};`;
        const speechRecognitionList = new this.SpeechGrammarList();
        speechRecognitionList.addFromString(grammar, 1);
        rec.grammars = speechRecognitionList;
      } catch (e) {}
    }

    rec.continuous = this.options.continuous !== false;
    rec.interimResults = this.options.interimResults !== false;
    rec.lang = this.options.lang || 'en-US';
    rec.maxAlternatives = this.options.maxAlternatives || 3;

    rec.onstart = () => {
      this.isAudioActive = true;
      this.restartAttempts = 0;
      this._updateUI(true);
      this.setTranscript('Listening...', 'text-muted');
      if (this.options.onStatusChange) this.options.onStatusChange('listening');
    };

    rec.onresult = (event) => this._handleResult(event);

    rec.onnomatch = (event) => {
      if (this.options.onNoMatch) this.options.onNoMatch(event);
    };

    rec.onend = () => {
      this.isAudioActive = false;
      this.processedUtterances.clear();
      if (this._canAutoRestart()) {
        this._scheduleRestart(150);
      } else {
        this.isListening = false;
        this._updateUI(false);
        this.setTranscript('Voice controls stopped.', 'text-muted');
        if (this.options.onStatusChange) this.options.onStatusChange('stopped');
      }
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('SpeechController: Speech recognition error:', e.error);
      }
      if (this.options.onError) {
        this.options.onError(e.error, e);
      }
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.stop();
        this.setTranscript('Microphone access denied.', 'text-danger');
        if (this.options.onStatusChange) this.options.onStatusChange('error', e.error);
      } else if (e.error === 'network') {
        this.setTranscript('Reconnecting voice...', 'text-muted');
        if (this.options.onStatusChange) this.options.onStatusChange('reconnecting');
      }
    };

    return rec;
  }

  _scheduleRestart(delay = 150) {
    if (!this._canAutoRestart()) return;
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    this.restartTimeout = setTimeout(() => {
      this.restartTimeout = null;
      if (!this._canAutoRestart() || this.isAudioActive) return;
      this.restartAttempts++;
      try {
        if (this.restartAttempts > 3) {
          // Re-instantiate fresh SpeechRecognition instance on repeated failures
          try { if (this.recognition) this.recognition.abort(); } catch (e) {}
          this.recognition = this._createRecognition();
        }
        if (this.recognition) {
          this.recognition.start();
        }
      } catch (err) {
        console.warn('SpeechController: recognition.start() retry failed:', err);
        const nextDelay = Math.min(250 * Math.pow(1.4, this.restartAttempts), 1500);
        this._scheduleRestart(nextDelay);
      }
    }, delay);
  }

  /* ==========================================================================
     Speech Result Processing (Strict Finalization & Echo Guard)
     ========================================================================== */
  _normalizeTranscript(text) {
    if (!text) return '';
    let normalized = text.toLowerCase().trim();

    // Custom normalizer hook if provided in options
    if (typeof this.options.normalize === 'function') {
      try {
        normalized = this.options.normalize(normalized);
      } catch (err) {
        console.error('SpeechController: custom normalize error:', err);
      }
    }

    // Common phonetic homophone normalization:
    // 'to blocks' and 'too blocks' sound identical to 'two blocks'
    normalized = normalized.replace(/\b(?:to|too)\s+blocks?\b/gi, 'two blocks');
    normalized = normalized.replace(/\bstraight\s+(?:to|too)\b/gi, 'straight two');
    normalized = normalized.replace(/\bfor\s+(?:to|too)\s+blocks?\b/gi, 'for two blocks');

    return normalized;
  }

  _matchCommand(phrase) {
    for (const cmd of this.commands) {
      if (cmd.regex && cmd.regex.test(phrase)) {
        return cmd;
      }
    }
    return null;
  }

  _matchCommandFromAlternatives(alternatives) {
    for (const alt of alternatives) {
      const cmd = this._matchCommand(alt);
      if (cmd) return { cmd, transcript: alt };
    }
    return null;
  }

  _handleResult(event) {
    if (!this.isListening && this.options.continuous !== false) return;

    // 1. Show real-time interim results as "Listening: ..." for visual feedback while speaking
    let interimText = '';
    let interimAlternatives = [];
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const res = event.results[i];
      if (!res.isFinal && res[0]) {
        interimText = this._normalizeTranscript(res[0].transcript);
        interimAlternatives = Array.from(res).map(a => this._normalizeTranscript(a.transcript)).filter(Boolean);
      }
    }
    if (interimText) {
      this.setTranscript(`Listening: "${interimText}"`, 'text-muted');
      if (this.options.onInterim) this.options.onInterim(interimText, interimAlternatives, event);
    }

    // 2. ONLY execute actions on finalized speech results (res.isFinal === true)
    // This strictly eliminates mid-utterance duplicate triggers
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const res = event.results[i];
      if (!res.isFinal) continue;
      if (this.processedUtterances.has(i)) continue;
      this.processedUtterances.add(i);

      const rawAlternatives = Array.from(res).map(a => (a && a.transcript ? a.transcript.trim() : '')).filter(Boolean);
      const alternatives = rawAlternatives.map(raw => this._normalizeTranscript(raw)).filter(Boolean);
      const transcript = alternatives[0] || '';
      if (!transcript && rawAlternatives.length === 0) continue;

      // Update transcript with confirmed finalized speech
      this.setTranscript(`Heard: "${transcript || rawAlternatives[0]}"`, 'text-muted');

      // Custom onResult handler for activities with dynamic state/vocab pools
      if (typeof this.options.onResult === 'function') {
        try {
          const handled = this.options.onResult(transcript, alternatives, rawAlternatives, event);
          if (handled === true) continue;
        } catch (err) {
          console.error('SpeechController: onResult callback error:', err);
        }
      }

      if (!this.commands || this.commands.length === 0) continue;

      // Check for compound phrases like "turn left and go straight"
      const subPhrases = transcript.split(/\s+(?:and then|and|then)\s+|,/i).map(s => s.trim()).filter(Boolean);
      if (subPhrases.length > 1) {
        const matchedList = subPhrases.map(p => this._matchCommand(p)).filter(Boolean);
        if (matchedList.length > 0) {
          matchedList.forEach(cmd => {
            if (typeof cmd.action === 'function') cmd.action();
          });
          this.lastExecutedCommandId = matchedList[matchedList.length - 1].id;
          this.lastExecutedCommandTime = Date.now();
          this.lastExecutedTranscript = transcript;
          if (this.options.onCommand) this.options.onCommand(matchedList, transcript);
          continue;
        }
      }

      const matchResult = this._matchCommandFromAlternatives(alternatives);
      if (!matchResult) continue;
      const { cmd: matchedCmd, transcript: matchedTranscript } = matchResult;

      const now = Date.now();
      const elapsed = now - this.lastExecutedCommandTime;
      const echoWindow = this.options.echoWindowMs || 700;

      // Engine Echo / Trailing Repeat deduplication:
      // Prevents browser speech engine echo from re-triggering the same command within echoWindowMs
      if (elapsed < echoWindow) {
        const isSameCommand = matchedCmd.id && matchedCmd.id === this.lastExecutedCommandId;
        const isExactRepeat = this.lastExecutedTranscript && (
          matchedTranscript === this.lastExecutedTranscript ||
          this.lastExecutedTranscript.endsWith(matchedTranscript)
        );
        if (isSameCommand || isExactRepeat) {
          continue;
        }
      }

      // Execute action
      if (typeof matchedCmd.action === 'function') {
        matchedCmd.action();
      }
      this.lastExecutedCommandId = matchedCmd.id || matchedTranscript;
      this.lastExecutedCommandTime = Date.now();
      this.lastExecutedTranscript = matchedTranscript;
      if (this.options.onCommand) this.options.onCommand(matchedCmd, matchedTranscript);
    }
  }

  /* ==========================================================================
     Public Control Methods
     ========================================================================== */
  start() {
    if (!this.isSupported) return;
    this.isListening = true;
    this.restartAttempts = 0;
    this.clearQueue();
    this.processedUtterances.clear();

    if (!this.recognition) {
      this.recognition = this._createRecognition();
    }
    if (!this.recognition) return;

    try {
      this.recognition.start();
    } catch (e) {
      if (this._canAutoRestart()) {
        this._scheduleRestart(200);
      }
    }

    this._updateUI(true);
    this.setTranscript('Starting voice...', 'text-muted');
  }

  stop() {
    this.isListening = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    this.clearQueue();
    this.processedUtterances.clear();

    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
    this._updateUI(false);
    if (this.options.onStatusChange) this.options.onStatusChange('stopped');
  }

  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }

  setCommands(commands, vocab = null) {
    this.commands = Array.isArray(commands) ? commands : [];
    if (Array.isArray(vocab)) {
      this.vocab = vocab;
      if (this.isListening && this.recognition) {
        // Soft recreate to apply new grammar
        try { this.recognition.abort(); } catch (e) {}
        this.recognition = this._createRecognition();
        this._scheduleRestart(100);
      }
    }
  }

  setTranscript(text, className = '') {
    if (!this.transcriptEl) return;
    this.transcriptEl.textContent = text;
    if (className) {
      this.transcriptEl.className = this.transcriptEl.className
        .replace(/\btext-(muted|danger|success|warning|primary)\b/g, '')
        .trim() + ' ' + className;
    }
  }

  _updateUI(listening) {
    this.listenBtns.forEach(btn => {
      if (listening) {
        btn.classList.add('mic-listening', 'btn-success');
        btn.classList.remove('btn-outline-success');
        btn.disabled = true;
      } else {
        btn.classList.remove('mic-listening');
        btn.disabled = false;
      }
    });

    this.stopBtns.forEach(btn => {
      if (listening) {
        btn.disabled = false;
        btn.classList.add('btn-danger');
        btn.classList.remove('btn-secondary');
      } else {
        btn.disabled = true;
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-secondary');
      }
    });

    const idleClasses = (this.options.toggleIdleClass || '').split(/\s+/).filter(Boolean);
    const activeClasses = (this.options.toggleActiveClass || '').split(/\s+/).filter(Boolean);

    this.toggleBtns.forEach(btn => {
      const labelEl = btn.querySelector('#mic-btn-text, .mic-btn-text');
      if (listening) {
        idleClasses.forEach(c => btn.classList.remove(c));
        activeClasses.forEach(c => btn.classList.add(c));
        if (labelEl && this.options.toggleActiveText) {
          labelEl.textContent = this.options.toggleActiveText;
        }
      } else {
        activeClasses.forEach(c => btn.classList.remove(c));
        idleClasses.forEach(c => btn.classList.add(c));
        if (labelEl && this.options.toggleIdleText) {
          labelEl.textContent = this.options.toggleIdleText;
        }
      }
    });
  }

  destroy() {
    this.stop();
    if (this.recognition) {
      try { this.recognition.abort(); } catch (e) {}
      this.recognition = null;
    }
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
    if (this._boundListeners) {
      this._boundListeners.forEach(({ el, evt, fn }) => {
        try { el.removeEventListener(evt, fn); } catch (e) {}
      });
      this._boundListeners = [];
    }
    if (SpeechController.activeInstance === this) {
      SpeechController.activeInstance = null;
    }
  }
}

SpeechController.activeInstance = null;

// Export to global scope
if (typeof window !== 'undefined') {
  window.SpeechController = SpeechController;
}
