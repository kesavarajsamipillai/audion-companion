// Audion Companion Plugin
// An all-in-one plugin showcasing:
// 1. UI Slot injection (Playerbar button + Modal)
// 2. Real-time Audio Visualizer Canvas
// 3. External Stream Resolver & Library Track Registration
// 4. Sleep Timer with countdown and auto-pause
// 5. Playback Stats & Scrobbler simulation

(function () {
    'use strict';

    const CompanionPlugin = {
        name: 'Audion Companion',
        api: null,
        modalElement: null,
        barButtonElement: null,
        menuButtonElement: null,
        activeTab: 'visualizer',
        isOpen: false,

        // State & Timers
        isPlaying: false,
        currentTrack: null,
        playHistory: [],
        animFrameId: null,
        sleepTimerInterval: null,
        sleepSecondsRemaining: 0,
        sleepTimerInitial: 0,

        // Settings (persisted via api.storage)
        settings: {
            visualizerMode: 'bars', // 'bars' | 'wave' | 'dots'
            scrobbleWebhook: '',
            notifyOnSleep: true
        },

        // --- Lifecycle Hooks ---

        async init(api) {
            console.log('[AudionCompanion] Initializing plugin...');
            this.api = api;

            // 1. Load saved settings from persistent storage
            await this.loadSettings();

            // 2. Register External Stream Resolver
            this.registerStreamResolver();

            // 3. Inject CSS Styles
            this.injectStyles();

            // 4. Create and Register UI Slots
            this.createUIElements();

            // 5. Register Player Event Listeners
            this.registerEventListeners();

            console.log('[AudionCompanion] Plugin initialized successfully.');
        },

        start() {
            console.log('[AudionCompanion] Plugin started.');
            if (this.api?.player?.isPlaying) {
                this.isPlaying = Boolean(this.api.player.isPlaying());
            }
            if (this.api?.player?.getCurrentTrack) {
                this.currentTrack = this.api.player.getCurrentTrack();
            }
            if (this.isOpen && this.activeTab === 'visualizer') {
                this.startVisualizer();
            }
        },

        stop() {
            console.log('[AudionCompanion] Plugin stopping...');
            this.stopVisualizer();
            this.clearSleepTimer();

            // Unregister UI slots
            if (this.api?.ui?.unregisterSlot) {
                this.api.ui.unregisterSlot('playerbar:right');
                this.api.ui.unregisterSlot('playerbar:menu');
            }

            // Remove DOM elements
            if (this.modalElement && this.modalElement.parentNode) {
                this.modalElement.parentNode.removeChild(this.modalElement);
            }
            if (this.barButtonElement && this.barButtonElement.parentNode) {
                this.barButtonElement.parentNode.removeChild(this.barButtonElement);
            }
            if (this.menuButtonElement && this.menuButtonElement.parentNode) {
                this.menuButtonElement.parentNode.removeChild(this.menuButtonElement);
            }

            const styleTag = document.getElementById('audion-companion-styles');
            if (styleTag && styleTag.parentNode) {
                styleTag.parentNode.removeChild(styleTag);
            }

            console.log('[AudionCompanion] Plugin stopped and cleaned up.');
        },

        // --- Stream Resolver & Library Integration ---

        registerStreamResolver() {
            if (!this.api?.stream?.registerResolver) {
                console.warn('[AudionCompanion] api.stream.registerResolver not available in this Audion version.');
                return;
            }

            // Register a custom source resolver called 'companion-source'
            this.api.stream.registerResolver('companion-source', async (externalId, options) => {
                console.log(`[AudionCompanion] Resolving stream for external ID: ${externalId}`);

                // In a production plugin, you would query an API (e.g. YouTube, SoundCloud, or custom server)
                // For demonstration, if externalId is an HTTP/HTTPS URL, return it directly
                if (externalId.startsWith('http://') || externalId.startsWith('https://')) {
                    return externalId;
                }

                // Or fallback to demo free audio stream
                return `https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3`;
            });

            console.log('[AudionCompanion] Registered resolver for: companion-source');
        },

        async addDemoStreamTrack() {
            if (!this.api?.library?.addExternalTrack) {
                alert('api.library.addExternalTrack is not available or requires library:write permission.');
                return;
            }

            const demoTrack = {
                title: "Lofi Chill Study (Companion Stream)",
                artist: "FASSounds",
                album: "Demo Streams",
                cover_url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300",
                source_type: "companion-source",
                external_id: "demo-track-001",
                duration: 160
            };

            try {
                await this.api.library.addExternalTrack(demoTrack);
                alert(`Added "${demoTrack.title}" to Audion library!`);
                this.recordLog(`Added external track: ${demoTrack.title}`);
            } catch (err) {
                console.error('[AudionCompanion] Failed to add track:', err);
                alert(`Error adding track: ${err.message || err}`);
            }
        },

        // --- Event Listeners ---

        registerEventListeners() {
            if (!this.api?.on) return;

            // Track changes
            this.api.on('trackChange', (data) => {
                const track = data?.track || data;
                this.currentTrack = track;
                this.recordLog(`Track changed: ${track?.title || 'Unknown'} - ${track?.artist || 'Unknown'}`);
                this.updateUI();
            });

            // Playback state changes
            const handlePlay = () => {
                this.isPlaying = true;
                if (this.isOpen && this.activeTab === 'visualizer') {
                    this.startVisualizer();
                }
                this.updateUI();
            };

            const handlePause = () => {
                this.isPlaying = false;
                this.updateUI();
            };

            this.api.on('play', handlePlay);
            this.api.on('pause', handlePause);
            this.api.on('playStateChange', (data) => {
                if (data && typeof data.isPlaying === 'boolean') {
                    this.isPlaying = data.isPlaying;
                    this.updateUI();
                }
            });

            this.api.on('timeUpdate', ({ currentTime, duration }) => {
                if (this.isOpen) {
                    const timeEl = document.getElementById('companion-track-time');
                    if (timeEl && duration) {
                        timeEl.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
                    }
                }
            });
        },

        // --- Settings / Storage ---

        async loadSettings() {
            if (!this.api?.storage?.get) return;
            try {
                const saved = await this.api.storage.get('companion_settings');
                if (saved) {
                    const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
                    this.settings = Object.assign(this.settings, parsed);
                }
            } catch (err) {
                console.warn('[AudionCompanion] Could not load settings:', err);
            }
        },

        async saveSettings() {
            if (!this.api?.storage?.set) return;
            try {
                await this.api.storage.set('companion_settings', JSON.stringify(this.settings));
            } catch (err) {
                console.warn('[AudionCompanion] Could not save settings:', err);
            }
        },

        // --- UI Construction ---

        createUIElements() {
            // 1. Create playerbar button element
            this.barButtonElement = document.createElement('button');
            this.barButtonElement.id = 'audion-companion-bar-btn';
            this.barButtonElement.className = 'companion-icon-btn';
            this.barButtonElement.title = 'Open Audion Companion';
            this.barButtonElement.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            `;
            this.barButtonElement.onclick = () => this.toggleModal();

            // 2. Menu button for mobile/popup menu slot
            this.menuButtonElement = document.createElement('div');
            this.menuButtonElement.className = 'companion-menu-item';
            this.menuButtonElement.innerHTML = `<span>Companion Toolkit</span>`;
            this.menuButtonElement.onclick = () => this.toggleModal();

            // Register in Audion UI slots
            if (this.api?.ui?.registerSlot) {
                this.api.ui.registerSlot('playerbar:right', this.barButtonElement, 20);
                this.api.ui.registerSlot('playerbar:menu', this.menuButtonElement, 20);
            }

            // 3. Create Main Modal
            this.modalElement = document.createElement('div');
            this.modalElement.id = 'audion-companion-modal';
            this.modalElement.className = 'companion-modal hidden';
            this.modalElement.innerHTML = `
                <div class="companion-backdrop" id="companion-backdrop"></div>
                <div class="companion-dialog">
                    <header class="companion-header">
                        <div class="companion-title">
                            <span class="companion-badge">PLUGIN</span>
                            <h2>Audion Companion</h2>
                        </div>
                        <button class="companion-close-btn" id="companion-close-btn">&times;</button>
                    </header>

                    <nav class="companion-nav">
                        <button class="companion-tab active" data-tab="visualizer">Visualizer</button>
                        <button class="companion-tab" data-tab="streaming">Streaming & Resolver</button>
                        <button class="companion-tab" data-tab="timer">Sleep Timer</button>
                        <button class="companion-tab" data-tab="scrobbler">Stats & Scrobble</button>
                    </nav>

                    <main class="companion-content">
                        <!-- TAB 1: VISUALIZER -->
                        <section class="companion-panel" id="panel-visualizer">
                            <div class="panel-header">
                                <div>
                                    <h3>Real-Time Audio Visualizer</h3>
                                    <p class="subtitle">Dynamic canvas render synced with playback</p>
                                </div>
                                <div class="viz-controls">
                                    <select id="viz-mode-select" class="companion-select">
                                        <option value="bars">Spectrum Bars</option>
                                        <option value="wave">Oscilloscope Wave</option>
                                        <option value="dots">Circular Pulse</option>
                                    </select>
                                </div>
                            </div>
                            <div class="canvas-container">
                                <canvas id="companion-viz-canvas" width="600" height="220"></canvas>
                            </div>
                            <div class="track-status-bar">
                                <span id="companion-track-title">No track playing</span>
                                <span id="companion-track-time">--:-- / --:--</span>
                            </div>
                        </section>

                        <!-- TAB 2: STREAM RESOLVER -->
                        <section class="companion-panel hidden" id="panel-streaming">
                            <div class="panel-header">
                                <div>
                                    <h3>Custom Stream Resolver</h3>
                                    <p class="subtitle">Resolves external stream IDs into playable URLs</p>
                                </div>
                            </div>
                            <div class="card">
                                <h4>Demonstration Source: <code>companion-source</code></h4>
                                <p>This demonstrates Audion's <code>api.stream.registerResolver</code> API. When you add a track with <code>source_type: "companion-source"</code>, Audion calls the plugin's registered callback to resolve the live audio URL.</p>
                                <div class="button-group">
                                    <button class="companion-btn primary" id="btn-add-demo-track">
                                        + Add Demo Stream Track to Library
                                    </button>
                                </div>
                            </div>
                            <div class="card">
                                <h4>Custom Stream Resolver Test</h4>
                                <div class="form-row">
                                    <input type="text" id="custom-stream-url" class="companion-input" placeholder="Enter Direct Audio URL (.mp3/.flac)" />
                                    <button class="companion-btn" id="btn-resolve-custom">Play Direct Stream</button>
                                </div>
                            </div>
                        </section>

                        <!-- TAB 3: SLEEP TIMER -->
                        <section class="companion-panel hidden" id="panel-timer">
                            <div class="panel-header">
                                <div>
                                    <h3>Music Sleep Timer</h3>
                                    <p class="subtitle">Automatically pause music after a set duration</p>
                                </div>
                            </div>
                            <div class="timer-display-box">
                                <div class="timer-time" id="sleep-timer-display">OFF</div>
                                <div class="timer-status" id="sleep-timer-status">No active timer</div>
                            </div>
                            <div class="preset-buttons">
                                <button class="companion-btn" data-minutes="15">15 Min</button>
                                <button class="companion-btn" data-minutes="30">30 Min</button>
                                <button class="companion-btn" data-minutes="45">45 Min</button>
                                <button class="companion-btn" data-minutes="60">60 Min</button>
                                <button class="companion-btn danger" id="btn-cancel-timer">Cancel Timer</button>
                            </div>
                        </section>

                        <!-- TAB 4: SCROBBLER & STATS -->
                        <section class="companion-panel hidden" id="panel-scrobbler">
                            <div class="panel-header">
                                <div>
                                    <h3>Playback Analytics & Scrobbler</h3>
                                    <p class="subtitle">Session event logger and webhook scrobbler</p>
                                </div>
                            </div>
                            <div class="card">
                                <h4>Custom Scrobble Webhook</h4>
                                <div class="form-row">
                                    <input type="text" id="scrobble-webhook-input" class="companion-input" placeholder="https://api.yourdomain.com/scrobble" />
                                    <button class="companion-btn" id="btn-save-webhook">Save Webhook</button>
                                </div>
                            </div>
                            <div class="card">
                                <h4>Event Log</h4>
                                <div class="log-container" id="companion-event-log">
                                    <div class="log-entry">Plugin ready.</div>
                                </div>
                            </div>
                        </section>
                    </main>
                </div>
            `;

            document.body.appendChild(this.modalElement);
            this.bindUIEvents();
        },

        bindUIEvents() {
            // Close buttons
            const closeBtn = document.getElementById('companion-close-btn');
            const backdrop = document.getElementById('companion-backdrop');
            if (closeBtn) closeBtn.onclick = () => this.closeModal();
            if (backdrop) backdrop.onclick = () => this.closeModal();

            // Tab switching
            const tabs = this.modalElement.querySelectorAll('.companion-tab');
            tabs.forEach(tab => {
                tab.onclick = () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.switchTab(tab.getAttribute('data-tab'));
                };
            });

            // Visualizer Mode
            const vizSelect = document.getElementById('viz-mode-select');
            if (vizSelect) {
                vizSelect.value = this.settings.visualizerMode;
                vizSelect.onchange = (e) => {
                    this.settings.visualizerMode = e.target.value;
                    this.saveSettings();
                };
            }

            // Stream resolver demo button
            const addTrackBtn = document.getElementById('btn-add-demo-track');
            if (addTrackBtn) {
                addTrackBtn.onclick = () => this.addDemoStreamTrack();
            }

            // Custom stream direct play
            const playCustomBtn = document.getElementById('btn-resolve-custom');
            if (playCustomBtn) {
                playCustomBtn.onclick = () => {
                    const input = document.getElementById('custom-stream-url');
                    const url = input?.value?.trim();
                    if (!url) return alert('Please enter an audio stream URL');
                    if (this.api?.player?.setTrack) {
                        this.api.player.setTrack({
                            title: 'External Stream',
                            artist: 'Custom Streamer',
                            album: 'Live Stream',
                            url: url,
                            source_type: 'companion-source',
                            external_id: url
                        });
                        this.api.player.play?.();
                        this.recordLog(`Playing stream: ${url}`);
                    }
                };
            }

            // Sleep Timer buttons
            const timerButtons = this.modalElement.querySelectorAll('[data-minutes]');
            timerButtons.forEach(btn => {
                btn.onclick = () => {
                    const mins = parseInt(btn.getAttribute('data-minutes'), 10);
                    this.startSleepTimer(mins);
                };
            });

            const cancelTimerBtn = document.getElementById('btn-cancel-timer');
            if (cancelTimerBtn) {
                cancelTimerBtn.onclick = () => this.clearSleepTimer();
            }

            // Webhook save
            const saveWebhookBtn = document.getElementById('btn-save-webhook');
            const webhookInput = document.getElementById('scrobble-webhook-input');
            if (webhookInput) {
                webhookInput.value = this.settings.scrobbleWebhook || '';
            }
            if (saveWebhookBtn && webhookInput) {
                saveWebhookBtn.onclick = () => {
                    this.settings.scrobbleWebhook = webhookInput.value.trim();
                    this.saveSettings();
                    alert('Webhook saved successfully.');
                };
            }
        },

        toggleModal() {
            if (this.isOpen) {
                this.closeModal();
            } else {
                this.openModal();
            }
        },

        openModal() {
            this.isOpen = true;
            this.modalElement.classList.remove('hidden');
            this.updateUI();
            if (this.activeTab === 'visualizer') {
                this.startVisualizer();
            }
        },

        closeModal() {
            this.isOpen = false;
            this.modalElement.classList.add('hidden');
            this.stopVisualizer();
        },

        switchTab(tabId) {
            this.activeTab = tabId;
            const panels = this.modalElement.querySelectorAll('.companion-panel');
            panels.forEach(p => p.classList.add('hidden'));

            const activePanel = document.getElementById(`panel-${tabId}`);
            if (activePanel) activePanel.classList.remove('hidden');

            if (tabId === 'visualizer') {
                this.startVisualizer();
            } else {
                this.stopVisualizer();
            }
        },

        // --- Visualizer Engine ---

        startVisualizer() {
            this.stopVisualizer();
            const canvas = document.getElementById('companion-viz-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            let phase = 0;

            const render = () => {
                if (!this.isOpen || this.activeTab !== 'visualizer') return;

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const isPlaying = this.isPlaying || Boolean(this.api?.player?.isPlaying?.());
                const mode = this.settings.visualizerMode;

                if (mode === 'bars') {
                    this.drawSpectrumBars(ctx, canvas.width, canvas.height, phase, isPlaying);
                } else if (mode === 'wave') {
                    this.drawOscilloscope(ctx, canvas.width, canvas.height, phase, isPlaying);
                } else {
                    this.drawCirclePulse(ctx, canvas.width, canvas.height, phase, isPlaying);
                }

                if (isPlaying) {
                    phase += 0.05;
                }

                this.animFrameId = requestAnimationFrame(render);
            };

            this.animFrameId = requestAnimationFrame(render);
        },

        stopVisualizer() {
            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }
        },

        drawSpectrumBars(ctx, w, h, phase, isPlaying) {
            const barCount = 32;
            const barWidth = (w / barCount) - 3;

            for (let i = 0; i < barCount; i++) {
                let amp = 0.15;
                if (isPlaying) {
                    amp = 0.2 + 0.7 * Math.abs(Math.sin(phase + i * 0.25) * Math.cos(phase * 0.7 + i * 0.1));
                }
                const barHeight = Math.max(6, amp * (h - 20));
                const x = i * (barWidth + 3) + 2;
                const y = h - barHeight - 10;

                const grad = ctx.createLinearGradient(0, y, 0, h);
                grad.addColorStop(0, '#1ed760');
                grad.addColorStop(1, '#0e7033');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(x, y, barWidth, barHeight, 3) : ctx.rect(x, y, barWidth, barHeight);
                ctx.fill();
            }
        },

        drawOscilloscope(ctx, w, h, phase, isPlaying) {
            ctx.strokeStyle = '#1ed760';
            ctx.lineWidth = 3;
            ctx.beginPath();

            const midY = h / 2;
            for (let x = 0; x < w; x++) {
                const normalizedX = x / w;
                let yOffset = 0;
                if (isPlaying) {
                    yOffset = Math.sin(phase + normalizedX * 12) * 35 +
                              Math.cos(phase * 1.5 + normalizedX * 24) * 15;
                }
                const y = midY + yOffset;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        },

        drawCirclePulse(ctx, w, h, phase, isPlaying) {
            const cx = w / 2;
            const cy = h / 2;
            const baseR = 40;
            const pulse = isPlaying ? Math.sin(phase * 2) * 15 : 0;
            const r = baseR + pulse;

            ctx.strokeStyle = '#1ed760';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();

            // Inner circle
            ctx.fillStyle = 'rgba(30, 215, 96, 0.2)';
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
            ctx.fill();
        },

        // --- Sleep Timer Logic ---

        startSleepTimer(minutes) {
            this.clearSleepTimer();
            this.sleepSecondsRemaining = minutes * 60;
            this.sleepTimerInitial = this.sleepSecondsRemaining;

            this.updateSleepTimerUI();

            this.sleepTimerInterval = setInterval(() => {
                this.sleepSecondsRemaining--;
                this.updateSleepTimerUI();

                if (this.sleepSecondsRemaining <= 0) {
                    this.clearSleepTimer();
                    this.executeSleepTimerTrigger();
                }
            }, 1000);

            this.recordLog(`Sleep timer set for ${minutes} minutes.`);
        },

        clearSleepTimer() {
            if (this.sleepTimerInterval) {
                clearInterval(this.sleepTimerInterval);
                this.sleepTimerInterval = null;
            }
            this.sleepSecondsRemaining = 0;
            this.updateSleepTimerUI();
        },

        executeSleepTimerTrigger() {
            console.log('[AudionCompanion] Sleep timer expired. Pausing playback.');
            if (this.api?.player?.pause) {
                this.api.player.pause();
            }
            this.recordLog('Sleep timer expired. Playback paused.');

            if (this.api?.system?.notify && this.settings.notifyOnSleep) {
                this.api.system.notify('Audion Sleep Timer', 'Playback has paused automatically.');
            }
        },

        updateSleepTimerUI() {
            const displayEl = document.getElementById('sleep-timer-display');
            const statusEl = document.getElementById('sleep-timer-status');
            if (!displayEl) return;

            if (this.sleepSecondsRemaining > 0) {
                const mins = Math.floor(this.sleepSecondsRemaining / 60);
                const secs = this.sleepSecondsRemaining % 60;
                displayEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                if (statusEl) statusEl.textContent = 'Timer Active';
            } else {
                displayEl.textContent = 'OFF';
                if (statusEl) statusEl.textContent = 'No active timer';
            }
        },

        // --- UI Updates & Logging ---

        updateUI() {
            const track = this.currentTrack || this.api?.player?.getCurrentTrack?.();
            const trackTitleEl = document.getElementById('companion-track-title');
            if (trackTitleEl) {
                if (track) {
                    trackTitleEl.textContent = `${track.title || 'Unknown Track'} — ${track.artist || 'Unknown Artist'}`;
                } else {
                    trackTitleEl.textContent = 'No track playing';
                }
            }
        },

        recordLog(message) {
            const logBox = document.getElementById('companion-event-log');
            if (!logBox) return;

            const time = new Date().toLocaleTimeString();
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.textContent = `[${time}] ${message}`;
            logBox.prepend(entry);

            // Trigger webhook scrobbler if configured
            if (this.settings.scrobbleWebhook && this.api?.fetch) {
                this.api.fetch(this.settings.scrobbleWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event: 'log', message, timestamp: Date.now() })
                }).catch(err => console.warn('[AudionCompanion] Webhook send error:', err));
            }
        },

        formatTime(seconds) {
            if (!seconds || isNaN(seconds)) return '00:00';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        },

        // --- Stylesheet Injection ---

        injectStyles() {
            if (document.getElementById('audion-companion-styles')) return;

            const style = document.createElement('style');
            style.id = 'audion-companion-styles';
            style.textContent = `
                /* Playerbar slot button */
                .companion-icon-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary, #b3b3b3);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 8px;
                    border-radius: 50%;
                    transition: all 0.2s ease;
                }
                .companion-icon-btn:hover {
                    color: var(--text-primary, #ffffff);
                    background: rgba(255, 255, 255, 0.1);
                }

                .companion-menu-item {
                    padding: 10px 14px;
                    color: var(--text-primary, #fff);
                    cursor: pointer;
                    font-size: 14px;
                    border-radius: var(--radius-sm, 6px);
                }
                .companion-menu-item:hover {
                    background: rgba(255, 255, 255, 0.08);
                }

                /* Modal Container */
                .companion-modal {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .companion-modal.hidden {
                    display: none !important;
                }
                .companion-backdrop {
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(6px);
                }
                .companion-dialog {
                    position: relative;
                    width: 680px;
                    max-width: 90vw;
                    max-height: 85vh;
                    background: var(--bg-surface, #1e1e1e);
                    border: 1px solid var(--border-color, #333333);
                    border-radius: var(--radius-md, 12px);
                    color: var(--text-primary, #ffffff);
                    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }

                /* Header */
                .companion-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border-color, #2d2d2d);
                }
                .companion-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .companion-title h2 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                }
                .companion-badge {
                    font-size: 10px;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: var(--accent-primary, #1ed760);
                    color: #000000;
                }
                .companion-close-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary, #999);
                    font-size: 24px;
                    cursor: pointer;
                    line-height: 1;
                }
                .companion-close-btn:hover {
                    color: var(--text-primary, #fff);
                }

                /* Navigation Tabs */
                .companion-nav {
                    display: flex;
                    background: var(--bg-base, #121212);
                    border-bottom: 1px solid var(--border-color, #2d2d2d);
                    overflow-x: auto;
                }
                .companion-tab {
                    padding: 12px 18px;
                    background: transparent;
                    border: none;
                    border-bottom: 2px solid transparent;
                    color: var(--text-secondary, #aaa);
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.15s ease;
                }
                .companion-tab:hover {
                    color: var(--text-primary, #fff);
                }
                .companion-tab.active {
                    color: var(--accent-primary, #1ed760);
                    border-bottom-color: var(--accent-primary, #1ed760);
                }

                /* Content Area */
                .companion-content {
                    padding: 20px;
                    overflow-y: auto;
                    flex: 1;
                }
                .companion-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .companion-panel.hidden {
                    display: none;
                }

                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .panel-header h3 {
                    margin: 0 0 4px 0;
                    font-size: 16px;
                }
                .subtitle {
                    margin: 0;
                    font-size: 12px;
                    color: var(--text-secondary, #888);
                }

                /* Visualizer */
                .canvas-container {
                    background: #111;
                    border-radius: var(--radius-sm, 8px);
                    border: 1px solid var(--border-color, #262626);
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                #companion-viz-canvas {
                    width: 100%;
                    height: 200px;
                    display: block;
                }
                .track-status-bar {
                    display: flex;
                    justify-content: space-between;
                    font-size: 13px;
                    color: var(--text-secondary, #aaa);
                    padding: 0 4px;
                }

                /* Cards and Form Controls */
                .card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid var(--border-color, #2a2a2a);
                    border-radius: var(--radius-sm, 8px);
                    padding: 16px;
                }
                .card h4 {
                    margin: 0 0 8px 0;
                    font-size: 14px;
                }
                .card p {
                    margin: 0 0 12px 0;
                    font-size: 12px;
                    line-height: 1.5;
                    color: var(--text-secondary, #999);
                }
                .form-row {
                    display: flex;
                    gap: 8px;
                }

                .companion-input {
                    flex: 1;
                    padding: 8px 12px;
                    background: #111;
                    border: 1px solid #333;
                    border-radius: var(--radius-sm, 6px);
                    color: #fff;
                    font-size: 13px;
                }
                .companion-input:focus {
                    outline: none;
                    border-color: var(--accent-primary, #1ed760);
                }

                .companion-select {
                    padding: 6px 10px;
                    background: #111;
                    border: 1px solid #333;
                    border-radius: 6px;
                    color: #fff;
                    font-size: 13px;
                }

                .companion-btn {
                    padding: 8px 16px;
                    background: #2a2a2a;
                    border: 1px solid #444;
                    border-radius: var(--radius-sm, 6px);
                    color: #fff;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .companion-btn:hover {
                    background: #333;
                }
                .companion-btn.primary {
                    background: var(--accent-primary, #1ed760);
                    color: #000;
                    border: none;
                    font-weight: 600;
                }
                .companion-btn.primary:hover {
                    filter: brightness(1.1);
                }
                .companion-btn.danger {
                    background: #a82424;
                    border-color: #8b1e1e;
                }
                .companion-btn.danger:hover {
                    background: #c92c2c;
                }

                /* Sleep Timer */
                .timer-display-box {
                    text-align: center;
                    padding: 24px;
                    background: rgba(255, 255, 255, 0.02);
                    border-radius: 8px;
                    border: 1px solid #282828;
                }
                .timer-time {
                    font-size: 44px;
                    font-weight: 700;
                    letter-spacing: 2px;
                    color: var(--accent-primary, #1ed760);
                }
                .timer-status {
                    font-size: 12px;
                    color: var(--text-secondary, #888);
                    margin-top: 4px;
                }
                .preset-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    justify-content: center;
                }

                /* Log Viewer */
                .log-container {
                    background: #0d0d0d;
                    border-radius: 6px;
                    padding: 10px 12px;
                    max-height: 140px;
                    overflow-y: auto;
                    font-family: monospace;
                    font-size: 11px;
                    color: #88ff88;
                }
                .log-entry {
                    padding: 2px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
            `;

            document.head.appendChild(style);
        }
    };

    // Register with Audion's global plugin host
    if (typeof window !== 'undefined' && window.Audion && typeof window.Audion.register === 'function') {
        window.Audion.register(CompanionPlugin);
    } else if (typeof Audion !== 'undefined' && typeof Audion.register === 'function') {
        Audion.register(CompanionPlugin);
    } else {
        console.warn('[AudionCompanion] Audion global runtime not found. Ready for injection.');
        // Expose globally for testing or manual initialization
        window.AudionCompanionPlugin = CompanionPlugin;
    }
})();
