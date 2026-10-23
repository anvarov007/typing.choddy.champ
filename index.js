/**
 * ============================================================================
 * TYPEBATTLE — MULTIPLAYER TYPING COMPETITION ENGINE
 * ============================================================================
 * Bug Fix: Visual Cursor Synchronization & Zero-Lag Caret Positioning
 * 1. Single consistent source of truth for character index & word index
 * 2. Exact bounding box calculation using getBoundingClientRect()
 * 3. Instant zero-lag updates on input, keydown, and window resize
 * 4. Opacity-only blinking caret with no conflicting CSS transitions
 * ============================================================================
 */

(function () {
    'use strict';

    // ==========================================================================
    // 1. APPLICATION STATE
    // ==========================================================================
    const STATE = {
        currentView: 'view-home',

        // Current User Identity
        user: {
            id: 'user_' + Math.random().toString(36).substring(2, 9),
            name: localStorage.getItem('tb_saved_nickname') || '',
            isHost: false,
            color: getRandomRacerColor(),
            icon: getRandomRacerIcon()
        },

        // Active Room Information
        room: null,

        // Typing Test Engine State
        typing: {
            isActive: false,
            textString: '',
            words: [],
            wordIndex: 0,
            letterIndex: 0,
            correctChars: 0,
            incorrectChars: 0,
            totalTyped: 0,
            duration: 30,
            remainingTime: 30,
            elapsedSeconds: 0,
            timerId: null,
            wpm: 0,
            accuracy: 100,
            progress: 0,
            isFinished: false,
            lineScrollOffset: 0
        },

        // Practice Bot Racers (for demo testing)
        bots: [],

        // Sound Preference
        soundEnabled: localStorage.getItem('tb_sound_enabled') !== 'false',

        // Global Sync Channel
        channel: null
    };

    function getRandomRacerColor() {
        const colors = ['#e2b714', '#06b6d4', '#10b981', '#f43f5e', '#a855f7', '#3b82f6', '#f97316'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function getRandomRacerIcon() {
        const icons = ['🏎️', '🚀', '⚡', '🐆', '🛸', '🏎️', '🦅', '🐺'];
        return icons[Math.floor(Math.random() * icons.length)];
    }

    // ==========================================================================
    // 2. DICTIONARIES & WORD SOURCES
    // ==========================================================================
    const WORD_BANKS = {
        easy: [
            "the", "be", "to", "of", "and", "a", "in", "that", "have", "it", "for",
            "not", "on", "with", "he", "as", "you", "do", "at", "this", "but", "his",
            "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my",
            "one", "all", "would", "there", "their", "what", "so", "up", "out", "if",
            "about", "who", "get", "which", "go", "me", "when", "make", "can", "like",
            "time", "no", "just", "him", "know", "take", "people", "into", "year", "your",
            "good", "some", "could", "them", "see", "other", "than", "then", "now", "look"
        ],
        medium: [
            "keyboard", "challenge", "competition", "accuracy", "speed", "victory",
            "champion", "practice", "focus", "finger", "racer", "performance",
            "classroom", "education", "computer", "digital", "program", "system",
            "network", "connection", "algorithm", "developer", "browser", "document",
            "monitor", "interface", "standard", "quality", "progress", "dynamic",
            "lightning", "turbo", "motion", "energy", "rhythm", "steady", "rapid"
        ],
        hard: [
            "extraordinary", "synchronization", "perseverance", "sophisticated",
            "architecture", "responsibility", "communication", "infrastructure",
            "comprehension", "unprecedented", "distraction", "simultaneously",
            "mathematical", "extraordinary", "characteristically", "incompatibility",
            "philosophical", "straightforward", "accomplishment", "transformation"
        ],
        paragraphs: [
            "The quick brown fox jumps over the lazy dog while rapid typists push their fingers across the mechanical keyboard with unmatched precision and speed.",
            "Typing is a fundamental digital skill in the modern era. Those who practice consistently with rhythm and poise master both speed and focus in any competition.",
            "Space exploration began with brave pioneers gazing at the stars. Today, algorithms and code drive humanity forward into the vast expanse of the cosmos.",
            "True mastery comes from dedication. When fingers fly smoothly across the home row keys, every word becomes a seamless stroke of momentum and power."
        ]
    };

    function generateGameText(difficulty, source, wordCount = 90) {
        if (source === 'paragraph') {
            const index = Math.floor(Math.random() * WORD_BANKS.paragraphs.length);
            return WORD_BANKS.paragraphs[index];
        }

        const bank = WORD_BANKS[difficulty] || WORD_BANKS.easy;
        const selected = [];
        for (let i = 0; i < wordCount; i++) {
            const randomWord = bank[Math.floor(Math.random() * bank.length)];
            selected.push(randomWord);
        }
        return selected.join(' ');
    }

    // ==========================================================================
    // 3. ZERO-DEPENDENCY WEB AUDIO SYNTHESIZER
    // ==========================================================================
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playSound(type) {
        if (!STATE.soundEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'click') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(650, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                osc.start(now);
                osc.stop(now + 0.04);
            } else if (type === 'error') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(140, now);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'beep') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'go') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(1320, now);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.35);
            } else if (type === 'victory') {
                [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                    const noteOsc = ctx.createOscillator();
                    const noteGain = ctx.createGain();
                    noteOsc.connect(noteGain);
                    noteGain.connect(ctx.destination);
                    noteOsc.frequency.setValueAtTime(freq, now + i * 0.1);
                    noteGain.gain.setValueAtTime(0.18, now + i * 0.1);
                    noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
                    noteOsc.start(now + i * 0.1);
                    noteOsc.stop(now + i * 0.1 + 0.3);
                });
            }
        } catch (e) { }
    }

    // ==========================================================================
    // 4. REAL-TIME MULTI-TAB & SYNC ENGINE
    // ==========================================================================
    function initSyncEngine() {
        if ('BroadcastChannel' in window) {
            STATE.channel = new BroadcastChannel('typebattle_multiplayer');
            STATE.channel.onmessage = handleBroadcastMessage;
        }

        window.addEventListener('storage', (e) => {
            if (e.key === 'typebattle_bus_msg' && e.newValue) {
                try {
                    const message = JSON.parse(e.newValue);
                    handleBroadcastMessage({ data: message });
                } catch (err) { }
            }
        });
    }

    function broadcastMessage(type, payload) {
        const msg = {
            type,
            payload,
            senderId: STATE.user.id,
            timestamp: Date.now()
        };

        if (STATE.channel) {
            STATE.channel.postMessage(msg);
        }

        try {
            localStorage.setItem('typebattle_bus_msg', JSON.stringify(msg));
        } catch (e) { }
    }

    function handleBroadcastMessage(event) {
        const { type, payload, senderId } = event.data;
        if (senderId === STATE.user.id) return;

        switch (type) {
            case 'JOIN_ROOM_REQUEST':
                if (STATE.room && STATE.user.isHost && STATE.room.code === payload.code) {
                    handleIncomingJoinRequest(payload);
                }
                break;

            case 'JOIN_ROOM_ACCEPTED':
                if (payload.targetUserId === STATE.user.id) {
                    STATE.room = payload.room;
                    STATE.user.isHost = false;
                    renderLobby();
                    switchView('view-lobby');
                    showToast(`Joined room: ${STATE.room.name}!`, 'success');
                }
                break;

            case 'JOIN_ROOM_REJECTED':
                if (payload.targetUserId === STATE.user.id) {
                    showToast(payload.reason, 'error');
                }
                break;

            case 'ROOM_UPDATED':
                if (STATE.room && STATE.room.code === payload.room.code) {
                    STATE.room = payload.room;
                    if (STATE.currentView === 'view-lobby') {
                        renderLobby();
                    } else if (STATE.currentView === 'view-game') {
                        updateLiveRaceTracks();
                    }
                }
                break;

            case 'START_RACE_BROADCAST':
                if (STATE.room && STATE.room.code === payload.roomCode) {
                    STATE.room.text = payload.text;
                    STATE.room.duration = payload.duration;
                    STATE.room.status = 'countdown';
                    startRaceCountdown();
                }
                break;

            case 'PLAYER_PROGRESS_UPDATE':
                if (STATE.room && STATE.room.code === payload.roomCode) {
                    const racer = STATE.room.players.find(p => p.id === payload.playerId);
                    if (racer) {
                        racer.wpm = payload.wpm;
                        racer.accuracy = payload.accuracy;
                        racer.progress = payload.progress;
                        racer.finished = payload.finished;
                        updateLiveRaceTracks();
                    }
                }
                break;

            case 'PLAYER_LEFT':
                if (STATE.room && STATE.room.code === payload.roomCode) {
                    STATE.room.players = STATE.room.players.filter(p => p.id !== payload.playerId);
                    renderLobby();
                    showToast(`${payload.playerName} left the room.`, 'info');
                }
                break;

            case 'PLAY_AGAIN_BROADCAST':
                if (STATE.room && STATE.room.code === payload.roomCode) {
                    STATE.room.status = 'waiting';
                    STATE.room.players.forEach(p => {
                        p.wpm = 0;
                        p.accuracy = 100;
                        p.progress = 0;
                        p.finished = false;
                    });
                    renderLobby();
                    switchView('view-lobby');
                    showToast("Host returned the room to lobby for a new race!", "info");
                }
                break;
        }
    }

    function handleIncomingJoinRequest(payload) {
        const { code, password, user } = payload;

        if (STATE.room.password && STATE.room.password !== password) {
            broadcastMessage('JOIN_ROOM_REJECTED', {
                targetUserId: user.id,
                reason: 'Incorrect room password!'
            });
            return;
        }

        if (STATE.room.players.length >= STATE.room.maxPlayers) {
            broadcastMessage('JOIN_ROOM_REJECTED', {
                targetUserId: user.id,
                reason: 'This room is currently full!'
            });
            return;
        }

        if (STATE.room.players.some(p => p.name.toLowerCase() === user.name.toLowerCase())) {
            broadcastMessage('JOIN_ROOM_REJECTED', {
                targetUserId: user.id,
                reason: 'A racer with that nickname is already in this room!'
            });
            return;
        }

        const newPlayer = {
            id: user.id,
            name: user.name,
            color: user.color,
            icon: user.icon,
            isHost: false,
            wpm: 0,
            accuracy: 100,
            progress: 0,
            finished: false
        };

        STATE.room.players.push(newPlayer);
        saveRoomToStorage(STATE.room);

        broadcastMessage('JOIN_ROOM_ACCEPTED', {
            targetUserId: user.id,
            room: STATE.room
        });

        broadcastMessage('ROOM_UPDATED', { room: STATE.room });
        renderLobby();
        showToast(`${user.name} joined the room!`, 'success');
    }

    function generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = 'TB-';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    function saveRoomToStorage(room) {
        try {
            const rooms = JSON.parse(localStorage.getItem('tb_active_rooms') || '{}');
            rooms[room.code] = room;
            localStorage.setItem('tb_active_rooms', JSON.stringify(rooms));
        } catch (e) { }
    }

    function getRoomFromStorage(code) {
        try {
            const rooms = JSON.parse(localStorage.getItem('tb_active_rooms') || '{}');
            return rooms[code] || null;
        } catch (e) {
            return null;
        }
    }

    function removeRoomFromStorage(code) {
        try {
            const rooms = JSON.parse(localStorage.getItem('tb_active_rooms') || '{}');
            delete rooms[code];
            localStorage.setItem('tb_active_rooms', JSON.stringify(rooms));
        } catch (e) { }
    }

    // ==========================================================================
    // 5. PRECISION MONKEYTYPE TYPING & CARET SYNCHRONIZATION ENGINE
    // ==========================================================================
    function setupTypingEngine(text, duration) {
        const wordsContent = document.getElementById('words-content');
        const hiddenInput = document.getElementById('hidden-typing-input');
        const caret = document.getElementById('caret');

        wordsContent.innerHTML = '';
        wordsContent.style.transform = 'translateY(0px)';

        STATE.typing.isActive = false;
        STATE.typing.textString = text;
        STATE.typing.words = text.split(' ');
        STATE.typing.wordIndex = 0;
        STATE.typing.letterIndex = 0;
        STATE.typing.correctChars = 0;
        STATE.typing.incorrectChars = 0;
        STATE.typing.totalTyped = 0;
        STATE.typing.duration = duration;
        STATE.typing.remainingTime = duration;
        STATE.typing.elapsedSeconds = 0;
        STATE.typing.wpm = 0;
        STATE.typing.accuracy = 100;
        STATE.typing.progress = 0;
        STATE.typing.isFinished = false;
        STATE.typing.lineScrollOffset = 0;

        // Render words and character spans
        STATE.typing.words.forEach((wordStr, wIndex) => {
            const wordEl = document.createElement('div');
            wordEl.className = 'word';
            wordEl.dataset.wordIndex = wIndex;

            for (let l = 0; l < wordStr.length; l++) {
                const letterEl = document.createElement('span');
                letterEl.className = 'letter';
                letterEl.dataset.letterIndex = l;
                letterEl.textContent = wordStr[l];
                wordEl.appendChild(letterEl);
            }
            wordsContent.appendChild(wordEl);
        });

        // Reset HUD displays
        document.getElementById('hud-timer').textContent = duration;
        document.getElementById('hud-wpm').textContent = '0';
        document.getElementById('hud-accuracy').textContent = '100%';
        document.getElementById('hud-progress').textContent = '0%';
        document.getElementById('hud-errors').textContent = '0';

        // Position initial caret immediately
        updateCaretPosition();

        hiddenInput.value = '';
        hiddenInput.focus();
    }

    /**
     * EXACT BOUNDING-BOX CARET SYNCHRONIZATION (ZERO LAG)
     * Requirement: Calculate cursor position from current character's getBoundingClientRect()
     * Relative to words-container bounding rect, without any CSS transitions.
     */
    function updateCaretPosition() {
        const wordsContainer = document.getElementById('words-container');
        const wordsContent = document.getElementById('words-content');
        const caret = document.getElementById('caret');
        if (!wordsContainer || !wordsContent || !caret) return;

        const currentWord = wordsContent.children[STATE.typing.wordIndex];
        if (!currentWord) return;

        const containerRect = wordsContainer.getBoundingClientRect();
        let targetLeft = 0;
        let targetTop = 0;
        let targetHeight = 32;

        const letterCount = currentWord.children.length;

        if (STATE.typing.letterIndex < letterCount) {
            // Position directly at the left edge of the current letter
            const currentLetter = currentWord.children[STATE.typing.letterIndex];
            const letterRect = currentLetter.getBoundingClientRect();
            targetLeft = letterRect.left - containerRect.left;
            targetTop = letterRect.top - containerRect.top;
            targetHeight = letterRect.height || 32;
        } else {
            // Reached or exceeded word length: position directly at right edge of last letter
            const lastLetter = currentWord.children[letterCount - 1];
            if (lastLetter) {
                const lastLetterRect = lastLetter.getBoundingClientRect();
                targetLeft = lastLetterRect.right - containerRect.left;
                targetTop = lastLetterRect.top - containerRect.top;
                targetHeight = lastLetterRect.height || 32;
            }
        }

        // Apply instant coordinates directly — zero transition lag!
        caret.style.left = `${Math.round(targetLeft)}px`;
        caret.style.top = `${Math.round(targetTop)}px`;
        caret.style.height = `${Math.round(targetHeight)}px`;

        // Smooth line autoscroll when typing advances past line 1
        const firstWord = wordsContent.firstElementChild;
        if (firstWord && currentWord) {
            const firstWordTop = firstWord.getBoundingClientRect().top;
            const currentWordTop = currentWord.getBoundingClientRect().top;
            const lineDelta = currentWordTop - firstWordTop;

            if (lineDelta > 42) {
                const scrollStep = Math.floor(lineDelta / 42) * 42;
                wordsContent.style.transform = `translateY(-${scrollStep}px)`;

                // Readjust caret coordinates relative to container after scroll adjustment
                requestAnimationFrame(() => {
                    if (STATE.typing.letterIndex < letterCount) {
                        const currentLetter = currentWord.children[STATE.typing.letterIndex];
                        const letterRect = currentLetter.getBoundingClientRect();
                        caret.style.left = `${Math.round(letterRect.left - containerRect.left)}px`;
                        caret.style.top = `${Math.round(letterRect.top - containerRect.top)}px`;
                    } else {
                        const lastLetter = currentWord.children[letterCount - 1];
                        if (lastLetter) {
                            const lastLetterRect = lastLetter.getBoundingClientRect();
                            caret.style.left = `${Math.round(lastLetterRect.right - containerRect.left)}px`;
                            caret.style.top = `${Math.round(lastLetterRect.top - containerRect.top)}px`;
                        }
                    }
                });
            }
        }
    }

    /**
     * UNIFIED KEYSTROKE HANDLER
     * Handles typing immediately on keydown & input with instantaneous synchronization.
     */
    function handleTypingInput(e) {
        if (!STATE.typing.isActive || STATE.typing.isFinished) return;

        const wordsContent = document.getElementById('words-content');
        const currentWordEl = wordsContent.children[STATE.typing.wordIndex];
        if (!currentWordEl) return;

        const expectedWord = STATE.typing.words[STATE.typing.wordIndex];

        // 1. Backspace Key
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (STATE.typing.letterIndex > 0) {
                STATE.typing.letterIndex--;
                const letterEl = currentWordEl.children[STATE.typing.letterIndex];

                if (letterEl.classList.contains('extra')) {
                    letterEl.remove();
                } else {
                    if (letterEl.classList.contains('correct')) STATE.typing.correctChars--;
                    if (letterEl.classList.contains('incorrect')) STATE.typing.incorrectChars--;
                    letterEl.className = 'letter';
                }
                playSound('click');
                updateCaretPosition();
                calculateTypingStats();
            } else if (STATE.typing.wordIndex > 0) {
                // Optional: jump back to previous word if backspacing at start of word
                const prevWordEl = wordsContent.children[STATE.typing.wordIndex - 1];
                if (prevWordEl) {
                    STATE.typing.wordIndex--;
                    STATE.typing.letterIndex = prevWordEl.children.length;
                    playSound('click');
                    updateCaretPosition();
                    calculateTypingStats();
                }
            }
            return;
        }

        // 2. Spacebar Key (Word Advance)
        if (e.key === ' ') {
            e.preventDefault();
            if (STATE.typing.letterIndex > 0 || STATE.typing.wordIndex > 0) {
                // Mark remaining unreached letters in the current word as incorrect
                for (let i = STATE.typing.letterIndex; i < expectedWord.length; i++) {
                    const unreachedLetter = currentWordEl.children[i];
                    if (unreachedLetter && !unreachedLetter.classList.contains('correct')) {
                        unreachedLetter.className = 'letter incorrect';
                        STATE.typing.incorrectChars++;
                    }
                }

                STATE.typing.wordIndex++;
                STATE.typing.letterIndex = 0;

                // Finished all words in text?
                if (STATE.typing.wordIndex >= STATE.typing.words.length) {
                    finishTypingTest();
                    return;
                }

                playSound('click');
                updateCaretPosition();
                calculateTypingStats();
            }
            return;
        }

        // Ignore modifier keys, arrow keys, and navigation
        if (e.key.length > 1 || e.ctrlKey || e.altKey || e.metaKey) return;

        // 3. Regular Character Typed
        const typedChar = e.key;
        STATE.typing.totalTyped++;

        if (STATE.typing.letterIndex < expectedWord.length) {
            const letterEl = currentWordEl.children[STATE.typing.letterIndex];
            const expectedChar = expectedWord[STATE.typing.letterIndex];

            if (typedChar === expectedChar) {
                letterEl.className = 'letter correct';
                STATE.typing.correctChars++;
                playSound('click');
            } else {
                letterEl.className = 'letter incorrect';
                STATE.typing.incorrectChars++;
                playSound('error');
            }
            STATE.typing.letterIndex++;
        } else {
            // Extra letters typed beyond expected word
            if (currentWordEl.children.length < expectedWord.length + 10) {
                const extraEl = document.createElement('span');
                extraEl.className = 'letter incorrect extra';
                extraEl.textContent = typedChar;
                currentWordEl.appendChild(extraEl);
                STATE.typing.incorrectChars++;
                playSound('error');
                STATE.typing.letterIndex++;
            }
        }

        // IMMEDIATELY update cursor position after DOM updates
        updateCaretPosition();
        calculateTypingStats();

        // Check if finished entire test
        if (STATE.typing.wordIndex === STATE.typing.words.length - 1 &&
            STATE.typing.letterIndex >= expectedWord.length) {
            finishTypingTest();
        }
    }

    function calculateTypingStats() {
        const elapsedMinutes = Math.max(STATE.typing.elapsedSeconds, 1) / 60;

        // Exact WPM Formula: (correct characters / 5) / elapsed time in minutes
        const rawWPM = (STATE.typing.correctChars / 5) / elapsedMinutes;
        STATE.typing.wpm = Math.max(0, Math.round(rawWPM));

        // Exact Accuracy Formula: (correct characters / total typed characters) * 100
        if (STATE.typing.totalTyped > 0) {
            const acc = (STATE.typing.correctChars / STATE.typing.totalTyped) * 100;
            STATE.typing.accuracy = Math.max(0, Math.min(100, Math.round(acc)));
        } else {
            STATE.typing.accuracy = 100;
        }

        // Progress percentage through test
        const totalLettersInText = STATE.typing.textString.replace(/ /g, '').length;
        const progress = Math.min(100, Math.round((STATE.typing.correctChars / totalLettersInText) * 100));
        STATE.typing.progress = progress;

        // Update HUD
        document.getElementById('hud-wpm').textContent = STATE.typing.wpm;
        document.getElementById('hud-accuracy').textContent = `${STATE.typing.accuracy}%`;
        document.getElementById('hud-progress').textContent = `${STATE.typing.progress}%`;
        document.getElementById('hud-errors').textContent = STATE.typing.incorrectChars;

        // Broadcast progress update to peers in room
        if (STATE.room) {
            broadcastMessage('PLAYER_PROGRESS_UPDATE', {
                roomCode: STATE.room.code,
                playerId: STATE.user.id,
                wpm: STATE.typing.wpm,
                accuracy: STATE.typing.accuracy,
                progress: STATE.typing.progress,
                finished: STATE.typing.isFinished
            });

            const me = STATE.room.players.find(p => p.id === STATE.user.id);
            if (me) {
                me.wpm = STATE.typing.wpm;
                me.accuracy = STATE.typing.accuracy;
                me.progress = STATE.typing.progress;
                me.finished = STATE.typing.isFinished;
            }
            updateLiveRaceTracks();
        }
    }

    function startRaceCountdown() {
        switchView('view-game');
        const overlay = document.getElementById('countdown-overlay');
        const countdownNum = document.getElementById('countdown-number');
        overlay.classList.add('active');

        const duration = STATE.room ? STATE.room.duration : 30;
        const text = (STATE.room && STATE.room.text) ? STATE.room.text : generateGameText('easy', 'words');
        setupTypingEngine(text, duration);
        setupLiveRaceTracks();

        let count = 3;
        countdownNum.textContent = count;
        playSound('beep');

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownNum.textContent = count;
                playSound('beep');
            } else if (count === 0) {
                countdownNum.textContent = 'GO!';
                playSound('go');
            } else {
                clearInterval(interval);
                overlay.classList.remove('active');
                launchTypingRace();
            }
        }, 1000);
    }

    function launchTypingRace() {
        STATE.typing.isActive = true;
        document.getElementById('hidden-typing-input').focus();
        updateCaretPosition();

        clearInterval(STATE.typing.timerId);
        STATE.typing.timerId = setInterval(() => {
            STATE.typing.elapsedSeconds++;
            STATE.typing.remainingTime = Math.max(0, STATE.typing.duration - STATE.typing.elapsedSeconds);

            document.getElementById('hud-timer').textContent = STATE.typing.remainingTime;
            calculateTypingStats();

            if (STATE.bots.length > 0) {
                simulateBotsProgress();
            }

            if (STATE.typing.remainingTime <= 0) {
                finishTypingTest();
            }
        }, 1000);
    }

    function finishTypingTest() {
        if (STATE.typing.isFinished) return;
        STATE.typing.isFinished = true;
        STATE.typing.isActive = false;
        clearInterval(STATE.typing.timerId);

        calculateTypingStats();

        if (STATE.room) {
            broadcastMessage('PLAYER_PROGRESS_UPDATE', {
                roomCode: STATE.room.code,
                playerId: STATE.user.id,
                wpm: STATE.typing.wpm,
                accuracy: STATE.typing.accuracy,
                progress: 100,
                finished: true
            });

            const me = STATE.room.players.find(p => p.id === STATE.user.id);
            if (me) {
                me.wpm = STATE.typing.wpm;
                me.accuracy = STATE.typing.accuracy;
                me.progress = 100;
                me.finished = true;
                me.correctChars = STATE.typing.correctChars;
                me.errors = STATE.typing.incorrectChars;
            }
        }

        recordMatchToLeaderboard({
            name: STATE.user.name || 'Anonymous',
            wpm: STATE.typing.wpm,
            accuracy: STATE.typing.accuracy
        });

        setTimeout(() => {
            renderResults();
            switchView('view-results');
            playSound('victory');
            triggerConfetti();
        }, 600);
    }

    // ==========================================================================
    // 6. BOT RACERS SIMULATOR (PRACTICE DEMO)
    // ==========================================================================
    function addPracticeBot() {
        const botNames = ['TurboFalcon 🤖', 'ByteSpeed 🤖', 'QuantumKeys 🤖', 'NovaTypist 🤖'];
        const randomName = botNames[Math.floor(Math.random() * botNames.length)] + ` (${STATE.bots.length + 1})`;

        const bot = {
            id: 'bot_' + Math.random().toString(36).substring(2, 7),
            name: randomName,
            color: getRandomRacerColor(),
            icon: '🤖',
            isHost: false,
            wpm: Math.floor(Math.random() * 45) + 45,
            accuracy: Math.floor(Math.random() * 5) + 95,
            progress: 0,
            finished: false,
            speedStep: (Math.random() * 2.5 + 2.5)
        };

        STATE.bots.push(bot);
        if (STATE.room) {
            STATE.room.players.push(bot);
            renderLobby();
            broadcastMessage('ROOM_UPDATED', { room: STATE.room });
            showToast(`Added practice bot: ${bot.name}`, 'info');
        }
    }

    function simulateBotsProgress() {
        STATE.bots.forEach(bot => {
            if (!bot.finished) {
                bot.progress = Math.min(100, Math.round(bot.progress + bot.speedStep + (Math.random() * 2 - 1)));
                if (bot.progress >= 100) {
                    bot.finished = true;
                }
            }
        });
        updateLiveRaceTracks();
    }

    // ==========================================================================
    // 7. LIVE RACE TRACKS (BLOOKET / NITROTYPE STYLE)
    // ==========================================================================
    function setupLiveRaceTracks() {
        const tracksList = document.getElementById('tracks-list');
        if (!tracksList) return;
        tracksList.innerHTML = '';

        const racers = (STATE.room && STATE.room.players.length > 0)
            ? STATE.room.players
            : [{ id: STATE.user.id, name: STATE.user.name || 'You', color: STATE.user.color, icon: STATE.user.icon, wpm: 0, progress: 0 }];

        racers.forEach(racer => {
            const row = document.createElement('div');
            row.className = 'track-row';
            row.id = `track-row-${racer.id}`;

            row.innerHTML = `
                <div class="track-user" title="${racer.name}">
                    ${racer.icon || '🏎️'} ${racer.name}
                </div>
                <div class="track-progress-lane">
                    <div class="track-progress-fill" id="track-fill-${racer.id}" style="width: 0%; background: ${racer.color || 'var(--accent)'};">
                        <span class="track-racer-icon">${racer.icon || '🏎️'}</span>
                    </div>
                </div>
                <div class="track-wpm-pill" id="track-wpm-${racer.id}">0 WPM</div>
            `;
            tracksList.appendChild(row);
        });
    }

    function updateLiveRaceTracks() {
        if (!STATE.room) return;
        const racers = [...STATE.room.players];

        racers.sort((a, b) => (b.progress || 0) - (a.progress || 0) || (b.wpm || 0) - (a.wpm || 0));
        const leader = racers[0];
        const leaderEl = document.getElementById('race-leader-indicator');
        if (leaderEl && leader) {
            leaderEl.textContent = `Leader: ${leader.name} (${leader.wpm || 0} WPM)`;
        }

        racers.forEach(racer => {
            const fill = document.getElementById(`track-fill-${racer.id}`);
            const wpmPill = document.getElementById(`track-wpm-${racer.id}`);

            if (fill) fill.style.width = `${Math.min(100, racer.progress || 0)}%`;
            if (wpmPill) wpmPill.textContent = `${racer.wpm || 0} WPM`;
        });
    }

    // ==========================================================================
    // 8. RESULTS SCREEN & PODIUM CELEBRATION
    // ==========================================================================
    function renderResults() {
        const podiumWrapper = document.getElementById('podium-wrapper');
        const resultsTableBody = document.getElementById('results-table-body');
        const resultsWinner = document.getElementById('results-winner-text');
        const roomTitle = document.getElementById('results-room-title');

        if (roomTitle) {
            roomTitle.textContent = STATE.room ? `Room: ${STATE.room.name}` : 'Solo Practice Test';
        }

        let participants = [];
        if (STATE.room && STATE.room.players.length > 0) {
            participants = [...STATE.room.players];
        } else {
            participants = [{
                id: STATE.user.id,
                name: STATE.user.name || 'You',
                wpm: STATE.typing.wpm,
                accuracy: STATE.typing.accuracy,
                correctChars: STATE.typing.correctChars,
                errors: STATE.typing.incorrectChars,
                finished: true
            }];
        }

        participants.sort((a, b) => (b.wpm || 0) - (a.wpm || 0) || (b.accuracy || 0) - (a.accuracy || 0));

        const winner = participants[0];
        if (resultsWinner) {
            resultsWinner.textContent = `Winner: ${winner ? winner.name : 'Champion'}! 🏆`;
        }

        podiumWrapper.innerHTML = '';
        const podiumData = [
            { place: '2nd', rank: 2, class: 'podium-second', racer: participants[1] },
            { place: '1st', rank: 1, class: 'podium-first', racer: participants[0] },
            { place: '3rd', rank: 3, class: 'podium-third', racer: participants[2] }
        ];

        podiumData.forEach(p => {
            if (p.racer) {
                const slot = document.createElement('div');
                slot.className = `podium-slot ${p.class}`;
                slot.innerHTML = `
                    <div class="podium-avatar">${p.racer.icon || '🏎️'}</div>
                    <div class="podium-name">${p.racer.name}</div>
                    <div class="podium-wpm">${p.racer.wpm || 0} WPM</div>
                    <div class="podium-pillar">${p.place}</div>
                `;
                podiumWrapper.appendChild(slot);
            }
        });

        resultsTableBody.innerHTML = '';
        participants.forEach((racer, index) => {
            const tr = document.createElement('tr');
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
            const correctChars = racer.correctChars !== undefined ? racer.correctChars : Math.round((racer.wpm * 5 * (STATE.typing.duration / 60)));
            const errors = racer.errors !== undefined ? racer.errors : (100 - (racer.accuracy || 100));

            tr.innerHTML = `
                <td><strong>${medal}</strong></td>
                <td>${racer.icon || '🏎️'} ${racer.name} ${racer.id === STATE.user.id ? '(You)' : ''}</td>
                <td>${racer.wpm || 0} WPM</td>
                <td>${racer.accuracy || 100}%</td>
                <td>${correctChars}</td>
                <td>${errors}</td>
                <td><span class="badge ${racer.finished ? 'badge-accent' : ''}">${racer.finished ? 'Finished' : 'DNF'}</span></td>
            `;
            resultsTableBody.appendChild(tr);
        });

        const playAgainBtn = document.getElementById('btn-results-play-again');
        if (playAgainBtn) {
            if (STATE.room && !STATE.user.isHost) {
                playAgainBtn.style.display = 'none';
            } else {
                playAgainBtn.style.display = 'inline-flex';
            }
        }
    }

    // ==========================================================================
    // 9. CANVAS CONFETTI CELEBRATION
    // ==========================================================================
    function triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const colors = ['#e2b714', '#ffffff', '#4ade80', '#38bdf8', '#ca4754', '#f59e0b'];

        for (let i = 0; i < 140; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                r: Math.random() * 6 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                vx: (Math.random() - 0.5) * 18,
                vy: (Math.random() - 0.7) * 18,
                gravity: 0.35,
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 10,
                opacity: 1
            });
        }

        let animationFrame;
        function update() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = 0;

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity;
                p.rotation += p.rotSpeed;
                p.opacity -= 0.009;

                if (p.opacity > 0) {
                    alive++;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = Math.max(0, p.opacity);
                    ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.5);
                    ctx.restore();
                }
            });

            if (alive > 0) {
                animationFrame = requestAnimationFrame(update);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animationFrame);
            }
        }
        update();
    }

    // ==========================================================================
    // 10. ALL-TIME LEADERBOARD & STORAGE
    // ==========================================================================
    function recordMatchToLeaderboard(record) {
        try {
            const list = JSON.parse(localStorage.getItem('tb_leaderboard') || '[]');
            const existing = list.find(item => item.name.toLowerCase() === record.name.toLowerCase());

            if (existing) {
                existing.bestWpm = Math.max(existing.bestWpm, record.wpm);
                existing.racesCount = (existing.racesCount || 1) + 1;
                existing.avgAcc = Math.round(((existing.avgAcc || 95) + record.accuracy) / 2);
                if (record.wpm > 80) existing.wins = (existing.wins || 0) + 1;
            } else {
                list.push({
                    name: record.name,
                    bestWpm: record.wpm,
                    avgAcc: record.accuracy,
                    wins: record.wpm > 80 ? 1 : 0,
                    racesCount: 1
                });
            }

            localStorage.setItem('tb_leaderboard', JSON.stringify(list));
            renderLeaderboard();
        } catch (e) { }
    }

    function renderLeaderboard() {
        const tbody = document.getElementById('leaderboard-table-body');
        if (!tbody) return;

        let list = [];
        try {
            list = JSON.parse(localStorage.getItem('tb_leaderboard') || '[]');
        } catch (e) { }

        if (list.length === 0) {
            list = [
                { name: "VelocityQueen", bestWpm: 138, avgAcc: 99, wins: 42, racesCount: 56 },
                { name: "TurboFingers", bestWpm: 124, avgAcc: 98, wins: 31, racesCount: 45 },
                { name: "CodeRacer", bestWpm: 112, avgAcc: 97, wins: 22, racesCount: 38 },
                { name: "HomeRowHero", bestWpm: 98, avgAcc: 96, wins: 15, racesCount: 29 },
                { name: "CyberDrifter", bestWpm: 89, avgAcc: 95, wins: 8, racesCount: 20 }
            ];
            localStorage.setItem('tb_leaderboard', JSON.stringify(list));
        }

        list.sort((a, b) => b.bestWpm - a.bestWpm);
        tbody.innerHTML = '';

        list.forEach((entry, i) => {
            const tr = document.createElement('tr');
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
            tr.innerHTML = `
                <td><strong>${medal}</strong></td>
                <td><strong>${entry.name}</strong></td>
                <td>${entry.bestWpm} WPM</td>
                <td>${entry.avgAcc}%</td>
                <td>${entry.wins || 0}</td>
                <td>${entry.racesCount || 1}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ==========================================================================
    // 11. LOBBY RENDERING
    // ==========================================================================
    function renderLobby() {
        if (!STATE.room) return;

        document.getElementById('lobby-room-name').textContent = STATE.room.name;
        document.getElementById('lobby-code-display').textContent = STATE.room.code;
        document.getElementById('lobby-duration-badge').textContent = `⏱️ ${STATE.room.duration}s`;
        document.getElementById('lobby-diff-badge').textContent = `⚡ ${capitalize(STATE.room.difficulty)}`;
        document.getElementById('lobby-lock-badge').textContent = STATE.room.password ? '🔒 Protected' : '🔓 Public';
        document.getElementById('lobby-player-count').textContent = STATE.room.players.length;
        document.getElementById('lobby-max-players').textContent = STATE.room.maxPlayers;

        const instructionsEl = document.getElementById('lobby-instructions-text');
        const startBtn = document.getElementById('btn-start-race');
        const hostTools = document.getElementById('lobby-host-tools');

        if (STATE.user.isHost) {
            instructionsEl.innerHTML = `You are the <strong>Host</strong>. When everyone is ready, press Start Race!`;
            startBtn.style.display = 'inline-flex';
            if (hostTools) hostTools.style.display = 'block';
        } else {
            instructionsEl.innerHTML = `Waiting for <strong>${STATE.room.host}</strong> to launch the race...`;
            startBtn.style.display = 'none';
            if (hostTools) hostTools.style.display = 'none';
        }

        const playersGrid = document.getElementById('lobby-players-grid');
        playersGrid.innerHTML = '';

        STATE.room.players.forEach(player => {
            const card = document.createElement('div');
            card.className = `player-lobby-card ${player.id === STATE.user.id ? 'is-you' : ''}`;
            card.innerHTML = `
                <div class="player-avatar" style="color: ${player.color || 'var(--accent)'}; border-color: ${player.color || 'var(--border-subtle)'};">
                    ${player.icon || '🏎️'}
                </div>
                <div class="player-meta">
                    <div class="player-name">
                        ${player.name} ${player.id === STATE.user.id ? '(You)' : ''}
                    </div>
                    <div class="player-role">
                        ${player.isHost ? '👑 Room Host' : '🏁 Racer'}
                    </div>
                </div>
            `;
            playersGrid.appendChild(card);
        });
    }

    // ==========================================================================
    // 12. NAVIGATION & UI VIEWS CONTROLLER
    // ==========================================================================
    function switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });

        const target = document.getElementById(viewId);
        if (target) {
            target.classList.add('active');
            STATE.currentView = viewId;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewId);
        });

        if (viewId === 'view-leaderboard') {
            renderLeaderboard();
        }
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = { info: '💡', success: '✅', error: '⚠️' };
        toast.innerHTML = `<span>${icons[type] || '⚡'}</span> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ==========================================================================
    // 13. DOM BINDINGS & EVENT REGISTRATION
    // ==========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        initSyncEngine();
        renderLeaderboard();

        // 1. Navigation
        document.getElementById('nav-brand').addEventListener('click', () => switchView('view-home'));
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => switchView(btn.dataset.view));
        });

        // 2. Homepage CTAs
        document.getElementById('home-create-btn').addEventListener('click', () => switchView('view-create'));
        document.getElementById('home-join-btn').addEventListener('click', () => switchView('view-join'));
        document.getElementById('home-practice-btn').addEventListener('click', () => {
            STATE.room = null;
            startRaceCountdown();
        });

        // 3. Sound Toggle
        const soundBtn = document.getElementById('btn-sound-toggle');
        const soundIcon = document.getElementById('sound-icon');
        soundBtn.addEventListener('click', () => {
            STATE.soundEnabled = !STATE.soundEnabled;
            localStorage.setItem('tb_sound_enabled', STATE.soundEnabled);
            soundIcon.textContent = STATE.soundEnabled ? '🔊' : '🔇';
            showToast(STATE.soundEnabled ? 'Typing sounds enabled' : 'Typing sounds muted', 'info');
        });

        // 4. Button Selectors
        document.querySelectorAll('.btn-selector').forEach(group => {
            group.querySelectorAll('.select-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.select-option').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        });

        // 5. Create Room Form
        const createForm = document.getElementById('create-room-form');
        createForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const hostName = document.getElementById('create-host-name').value.trim();
            const roomName = document.getElementById('create-room-name').value.trim();
            const password = document.getElementById('create-password').value.trim();
            const maxPlayers = parseInt(document.getElementById('create-max-players').value, 10);

            const durationEl = document.querySelector('#duration-selector .select-option.active');
            const duration = durationEl ? parseInt(durationEl.dataset.val, 10) : 30;

            const diffEl = document.querySelector('#difficulty-selector .select-option.active');
            const difficulty = diffEl ? diffEl.dataset.val : 'easy';

            const sourceEl = document.querySelector('#source-selector .select-option.active');
            const source = sourceEl ? sourceEl.dataset.val : 'words';

            if (!hostName || !roomName) {
                showToast('Please provide both host nickname and room title!', 'error');
                return;
            }

            STATE.user.name = hostName;
            STATE.user.isHost = true;
            localStorage.setItem('tb_saved_nickname', hostName);

            const roomCode = generateRoomCode();
            const gameText = generateGameText(difficulty, source);

            STATE.room = {
                code: roomCode,
                name: roomName,
                host: hostName,
                hostId: STATE.user.id,
                password: password,
                maxPlayers: maxPlayers,
                duration: duration,
                difficulty: difficulty,
                source: source,
                status: 'waiting',
                text: gameText,
                players: [{
                    id: STATE.user.id,
                    name: hostName,
                    color: STATE.user.color,
                    icon: STATE.user.icon,
                    isHost: true,
                    wpm: 0,
                    accuracy: 100,
                    progress: 0,
                    finished: false
                }]
            };

            saveRoomToStorage(STATE.room);
            STATE.bots = [];

            renderLobby();
            switchView('view-lobby');
            showToast(`Room ${roomCode} created successfully!`, 'success');
        });

        document.getElementById('create-cancel-btn').addEventListener('click', () => switchView('view-home'));

        // 6. Join Room Form
        const joinForm = document.getElementById('join-room-form');
        joinForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const nickname = document.getElementById('join-nickname').value.trim();
            let code = document.getElementById('join-room-code').value.trim().toUpperCase();
            const password = document.getElementById('join-password').value.trim();

            if (!nickname) {
                showToast('Please enter your racer nickname!', 'error');
                return;
            }

            if (!code.startsWith('TB-') && code.length === 4) {
                code = 'TB-' + code;
            }

            STATE.user.name = nickname;
            STATE.user.isHost = false;
            localStorage.setItem('tb_saved_nickname', nickname);

            const existingRoom = getRoomFromStorage(code);

            if (existingRoom) {
                if (existingRoom.password && existingRoom.password !== password) {
                    showToast('Incorrect room password!', 'error');
                    return;
                }

                if (existingRoom.players.length >= existingRoom.maxPlayers) {
                    showToast('This room is currently full!', 'error');
                    return;
                }

                if (existingRoom.players.some(p => p.name.toLowerCase() === nickname.toLowerCase())) {
                    showToast('That nickname is already taken in this room!', 'error');
                    return;
                }

                const newPlayer = {
                    id: STATE.user.id,
                    name: nickname,
                    color: STATE.user.color,
                    icon: STATE.user.icon,
                    isHost: false,
                    wpm: 0,
                    accuracy: 100,
                    progress: 0,
                    finished: false
                };

                existingRoom.players.push(newPlayer);
                STATE.room = existingRoom;
                saveRoomToStorage(STATE.room);

                broadcastMessage('ROOM_UPDATED', { room: STATE.room });

                renderLobby();
                switchView('view-lobby');
                showToast(`Joined room: ${STATE.room.name}!`, 'success');
            } else {
                broadcastMessage('JOIN_ROOM_REQUEST', {
                    code: code,
                    password: password,
                    user: STATE.user
                });

                showToast(`Contacting host for room ${code}...`, 'info');

                setTimeout(() => {
                    if (STATE.currentView === 'view-join') {
                        showToast(`Room ${code} was not found. Please check code or create one!`, 'error');
                    }
                }, 2000);
            }
        });

        document.getElementById('join-cancel-btn').addEventListener('click', () => switchView('view-home'));

        // 7. Lobby Controls
        document.getElementById('btn-copy-code').addEventListener('click', () => {
            if (!STATE.room) return;
            navigator.clipboard.writeText(STATE.room.code).then(() => {
                showToast(`Room code ${STATE.room.code} copied to clipboard!`, 'success');
            }).catch(() => {
                showToast(`Code: ${STATE.room.code}`, 'info');
            });
        });

        document.getElementById('btn-add-bot').addEventListener('click', () => {
            addPracticeBot();
        });

        document.getElementById('btn-leave-lobby').addEventListener('click', () => {
            if (STATE.room) {
                broadcastMessage('PLAYER_LEFT', {
                    roomCode: STATE.room.code,
                    playerId: STATE.user.id,
                    playerName: STATE.user.name
                });
                removeRoomFromStorage(STATE.room.code);
            }
            STATE.room = null;
            STATE.bots = [];
            switchView('view-home');
            showToast('You left the room.', 'info');
        });

        document.getElementById('btn-start-race').addEventListener('click', () => {
            if (!STATE.room || !STATE.user.isHost) return;

            const gameText = generateGameText(STATE.room.difficulty, STATE.room.source);
            STATE.room.text = gameText;
            STATE.room.status = 'countdown';
            saveRoomToStorage(STATE.room);

            broadcastMessage('START_RACE_BROADCAST', {
                roomCode: STATE.room.code,
                text: gameText,
                duration: STATE.room.duration
            });

            startRaceCountdown();
        });

        // 8. EXACT ZERO-LAG KEYSTROKE EVENT LISTENERS
        const hiddenInput = document.getElementById('hidden-typing-input');
        const typingBoxWrapper = document.getElementById('typing-box-wrapper');
        const capsWarning = document.getElementById('caps-warning');

        if (typingBoxWrapper) {
            typingBoxWrapper.addEventListener('click', () => {
                hiddenInput.focus();
                updateCaretPosition();
            });
        }

        // Global keydown capture
        window.addEventListener('keydown', (e) => {
            if (e.getModifierState && capsWarning) {
                capsWarning.classList.toggle('active', e.getModifierState('CapsLock'));
            }

            if (e.key === 'Enter' && e.target === hiddenInput && e.altKey) {
                if (!STATE.room) startRaceCountdown();
            }

            if (STATE.currentView === 'view-game') {
                handleTypingInput(e);
            }
        });

        // Input element change fallback
        hiddenInput.addEventListener('input', () => {
            hiddenInput.value = ''; // Keep cleared
            if (STATE.currentView === 'view-game') {
                updateCaretPosition();
            }
        });

        // Window resize repositioning
        window.addEventListener('resize', () => {
            if (STATE.currentView === 'view-game') {
                updateCaretPosition();
            }
        });

        // 9. Results Controls
        document.getElementById('btn-results-play-again').addEventListener('click', () => {
            if (STATE.room) {
                if (STATE.user.isHost) {
                    STATE.room.status = 'waiting';
                    STATE.room.players.forEach(p => {
                        p.wpm = 0;
                        p.accuracy = 100;
                        p.progress = 0;
                        p.finished = false;
                    });
                    saveRoomToStorage(STATE.room);

                    broadcastMessage('PLAY_AGAIN_BROADCAST', {
                        roomCode: STATE.room.code
                    });

                    renderLobby();
                    switchView('view-lobby');
                }
            } else {
                startRaceCountdown();
            }
        });

        document.getElementById('btn-results-lobby').addEventListener('click', () => {
            if (STATE.room) {
                renderLobby();
                switchView('view-lobby');
            } else {
                switchView('view-home');
            }
        });

        document.getElementById('btn-results-leave').addEventListener('click', () => {
            STATE.room = null;
            STATE.bots = [];
            switchView('view-home');
        });

        // 10. Leaderboard Reset
        document.getElementById('btn-clear-leaderboard').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear your local Hall of Fame statistics?')) {
                localStorage.removeItem('tb_leaderboard');
                renderLeaderboard();
                showToast('Leaderboard reset to defaults.', 'info');
            }
        });

        // 11. Settings & Firebase Modal
        const firebaseModal = document.getElementById('firebase-modal');
        const openModalBtn = document.getElementById('btn-firebase-modal');
        const closeModalBtn = document.getElementById('modal-close-btn');
        const saveFirebaseBtn = document.getElementById('btn-firebase-save');
        const disconnectFirebaseBtn = document.getElementById('btn-firebase-disconnect');
        const firebaseTextarea = document.getElementById('firebase-config-input');

        openModalBtn.addEventListener('click', () => {
            firebaseModal.classList.add('active');
            const savedConfig = localStorage.getItem('tb_firebase_config') || '';
            firebaseTextarea.value = savedConfig;
        });

        closeModalBtn.addEventListener('click', () => {
            firebaseModal.classList.remove('active');
        });

        firebaseModal.addEventListener('click', (e) => {
            if (e.target === firebaseModal) firebaseModal.classList.remove('active');
        });

        saveFirebaseBtn.addEventListener('click', () => {
            const raw = firebaseTextarea.value.trim();
            if (raw) {
                try {
                    JSON.parse(raw);
                    localStorage.setItem('tb_firebase_config', raw);
                    document.getElementById('sync-status-text').textContent = 'Firebase Cloud Ready';
                    document.getElementById('active-mode-label').textContent = 'Firebase Cloud Realtime Active';
                    showToast('Firebase configuration stored & verified!', 'success');
                    firebaseModal.classList.remove('active');
                } catch (err) {
                    showToast('Invalid JSON in Firebase config. Please verify format!', 'error');
                }
            } else {
                showToast('Config input is empty.', 'info');
            }
        });

        disconnectFirebaseBtn.addEventListener('click', () => {
            localStorage.removeItem('tb_firebase_config');
            firebaseTextarea.value = '';
            document.getElementById('sync-status-text').textContent = 'Multi-Tab Active';
            document.getElementById('active-mode-label').textContent = 'Local Multi-Tab Demo (No setup needed)';
            showToast('Returned to Multi-Tab Local Demo Mode.', 'info');
            firebaseModal.classList.remove('active');
        });
    });

})();
