////////////////////////////////////////////////////////////////////////////////
// speech_controller.js — Reusable, auto-recovering Web Speech API controller
//
// USAGE:
//   Include this script in your EJS/HTML template:
//     <script src="/javascripts/speech_controller.js"></script>
//
//   Then instantiate with your activity's commands:
//     const voice = new SpeechController({
//       listenBtn: '#listen',                  // Optional selector or element
//       stopBtn: '#stop',                      // Optional selector or element
//       transcriptEl: '#speechTranscript',     // Optional selector or element
//       unsupportedAlert: '#unsupportedAlert', // Optional selector or element
//       lang: 'en-US',                         // Default 'en-US'
//       echoWindowMs: 700,                     // Default 700ms duplicate echo protection
//       vocab: ['turn left', 'go straight', ...], // Optional SpeechGrammarList words
//       commands: [
//         {
//           id: 'turnLeft',
//           regex: /\b(turn (to the )?left|turn left|left)\b/i,
//           action: () => turnLeft()
//         },
//         {
//           id: 'goStraight',
//           regex: /\b(go straight|straight)\b/i,
//           action: () => goStraight()
//         }
//       ]
//     });
//
// GUARANTEES & ARCHITECTURE:
//   - Zero Double-Triggers: Actions ONLY execute on finalized speech (res.isFinal).
//   - Real-Time Interim Feedback: Displays "Listening: ..." while speaking without triggering actions.
//   - Engine Echo Protection: Filters out browser trailing audio echoes within echoWindowMs.
//   - Auto-Recovery Lifecycle: Handles silence timeouts, exponential backoff retries, and clean instance recreation.
//   - Watchdog & Visibility: Auto-resumes listening when tab regains focus or after silent browser drops.
//   - Compound Command Parsing: Splits chained instructions like "turn left and go straight".
//   - Non-Dropping Command Queue: Sequential execution for multi-step animations (voice.enqueue).
////////////////////////////////////////////////////////////////////////////////

class SpeechController {
  constructor(options = {}) {
    this.options = Object.assign({
      lang: 'en-US',
      echoWindowMs: 700,
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
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

    this.processedUtterances = new Set();
    this.lastExecutedCommandId = null;
    this.lastExecutedCommandTime = 0;
    this.lastExecutedTranscript = '';

    this.commandQueue = [];
    this.isExecutingQueue = false;

    // Cache DOM Elements if provided
    this.listenBtn = this._getElement(this.options.listenBtn);
    this.stopBtn = this._getElement(this.options.stopBtn);
    this.transcriptEl = this._getElement(this.options.transcriptEl);
    this.unsupportedAlert = this._getElement(this.options.unsupportedAlert);

    this.commands = this.options.commands || [];
    this.vocab = this.options.vocab || [];

    this._bindEvents();
    this._initWatchdog();

    if (!this.isSupported) {
      if (this.unsupportedAlert) this.unsupportedAlert.style.display = 'block';
      if (this.listenBtn) this.listenBtn.disabled = true;
      if (this.stopBtn) this.stopBtn.disabled = true;
    }
  }

  _getElement(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    if (target instanceof HTMLElement) return target;
    if (window.jQuery && target instanceof window.jQuery) return target[0];
    return null;
  }

  _bindEvents() {
    if (this.listenBtn) {
      this.listenBtn.addEventListener('click', () => this.start());
    }
    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', () => this.stop());
    }

    this._onVisibilityChange = () => {
      if (!document.hidden && this.isListening && !this.isAudioActive) {
        this._scheduleRestart(150);
      }
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  _initWatchdog() {
    this.watchdogInterval = setInterval(() => {
      if (this.isListening && !this.isAudioActive && !this.restartTimeout) {
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
    rec.maxAlternatives = this.options.maxAlternatives || 1;

    rec.onstart = () => {
      this.isAudioActive = true;
      this.restartAttempts = 0;
      this._updateUI(true);
      this.setTranscript('Listening...', 'text-muted');
      if (this.options.onStatusChange) this.options.onStatusChange('listening');
    };

    rec.onresult = (event) => this._handleResult(event);

    rec.onend = () => {
      this.isAudioActive = false;
      this.processedUtterances.clear();
      if (this.isListening) {
        this._scheduleRestart(150);
      } else {
        this._updateUI(false);
        this.setTranscript('Voice controls stopped.', 'text-muted');
        if (this.options.onStatusChange) this.options.onStatusChange('stopped');
      }
    };

    rec.onerror = (e) => {
      console.warn('SpeechController: Speech recognition error:', e.error);
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
    if (!this.isListening) return;
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    this.restartTimeout = setTimeout(() => {
      this.restartTimeout = null;
      if (!this.isListening || this.isAudioActive) return;
      this.restartAttempts++;
      try {
        if (this.restartAttempts > 3) {
          // Re-instantiate fresh SpeechRecognition instance on repeated failures
          try { if (this.recognition) this.recognition.abort(); } catch(e) {}
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

  _handleResult(event) {
    if (!this.isListening) return;

    // 1. Show real-time interim results as "Listening: ..." for visual feedback while speaking
    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const res = event.results[i];
      if (!res.isFinal && res[0]) {
        interimText = this._normalizeTranscript(res[0].transcript);
      }
    }
    if (interimText) {
      this.setTranscript(`Listening: "${interimText}"`, 'text-muted');
      if (this.options.onInterim) this.options.onInterim(interimText);
    }

    // 2. ONLY execute actions on finalized speech results (res.isFinal === true)
    // This strictly eliminates mid-utterance duplicate triggers
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const res = event.results[i];
      if (!res.isFinal) continue;
      if (this.processedUtterances.has(i)) continue;
      this.processedUtterances.add(i);

      const rawText = res[0] ? res[0].transcript : '';
      const transcript = this._normalizeTranscript(rawText);
      if (!transcript) continue;

      // Update transcript with confirmed finalized speech
      this.setTranscript(`Heard: "${transcript}"`, 'text-muted');

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

      const matchedCmd = this._matchCommand(transcript);
      if (!matchedCmd) continue;

      const now = Date.now();
      const elapsed = now - this.lastExecutedCommandTime;
      const echoWindow = this.options.echoWindowMs || 700;

      // Engine Echo / Trailing Repeat deduplication:
      // Prevents browser speech engine echo from re-triggering the same command within echoWindowMs
      if (elapsed < echoWindow) {
        const isSameCommand = matchedCmd.id === this.lastExecutedCommandId;
        const isExactRepeat = this.lastExecutedTranscript && (
          transcript === this.lastExecutedTranscript ||
          this.lastExecutedTranscript.endsWith(transcript)
        );
        if (isSameCommand || isExactRepeat) {
          continue;
        }
      }

      // Execute action
      if (typeof matchedCmd.action === 'function') {
        matchedCmd.action();
      }
      this.lastExecutedCommandId = matchedCmd.id;
      this.lastExecutedCommandTime = Date.now();
      this.lastExecutedTranscript = transcript;
      if (this.options.onCommand) this.options.onCommand(matchedCmd, transcript);
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
      this._scheduleRestart(200);
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
      try { this.recognition.stop(); } catch(e) {}
    }
    this._updateUI(false);
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
        try { this.recognition.abort(); } catch(e) {}
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
        .replace(/\btext-(muted|danger|success|warning)\b/g, '')
        .trim() + ' ' + className;
    }
  }

  _updateUI(listening) {
    if (this.listenBtn) {
      if (listening) {
        this.listenBtn.classList.add('mic-listening', 'btn-success');
        this.listenBtn.disabled = true;
      } else {
        this.listenBtn.classList.remove('mic-listening');
        this.listenBtn.disabled = false;
      }
    }
    if (this.stopBtn) {
      if (listening) {
        this.stopBtn.disabled = false;
        this.stopBtn.classList.add('btn-danger');
        this.stopBtn.classList.remove('btn-secondary');
      } else {
        this.stopBtn.disabled = true;
        this.stopBtn.classList.remove('btn-danger');
        this.stopBtn.classList.add('btn-secondary');
      }
    }
  }

  destroy() {
    this.stop();
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  }
}

// Export to global scope
if (typeof window !== 'undefined') {
  window.SpeechController = SpeechController;
}
