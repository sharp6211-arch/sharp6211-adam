(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const COLS = 10;
  const ROWS = 20;
  const BASE_DROP_INTERVAL = 820;
  const LOCK_DELAY = 450;
  const MAX_LEVEL = 50;
  const LINES_PER_LEVEL = 5;
  const STAGE_INTERVALS = [820, 760, 700, 640, 580, 520, 460, 390, 320, 250];

  const NEON_COLORS = [
    "#39ff14",
    "#00e5ff",
    "#ff4dff",
    "#ffe600",
    "#ff6a00",
    "#b0ff00",
    "#00ffa2"
  ];

  const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]]
  };

  let board = createBoard();
  let current = spawnPiece();
  let next = spawnPiece();
  let score = 0;
  let level = 1;
  let lines = 0;
  let gameOver = false;
  let particles = [];
  let lastTime = 0;
  let dropCounter = 0;
  let lockTimer = 0;

  let cell = 26;
  let boardX = 0;
  let boardY = 0;
  let boardWidth = 0;
  let boardHeight = 0;
  let audioCtx = null;
  let sfxEnabled = true;
  let bgmEnabled = true;
  let bgmGain = null;
  let bgmFilter = null;
  let bgmCompressor = null;
  let voiceBus = null;
  let voiceDryGain = null;
  let voiceWetGain = null;
  let voiceReverbSend = null;
  let voiceDelaySend = null;
  let voiceConvolver = null;
  let voiceDelay = null;
  let voiceDelayFeedback = null;
  let voicePingSend = null;
  let voicePingDelayL = null;
  let voicePingDelayR = null;
  let voicePingFeedbackL = null;
  let voicePingFeedbackR = null;
  let voicePingPannerL = null;
  let voicePingPannerR = null;
  let voicePingBoostTimer = 0;
  let voicePingBoostDuration = 650;
  let voicePingChainLevel = 0;
  let bgmStarted = false;
  let bgmNextNoteTime = 0;
  let bgmStep = 0;
  let gameCleared = false;
  let clearFxTimer = 0;
  let cameraShakeX = 0;
  let cameraShakeY = 0;
  let cameraShakePhase = 0;
  let glitchTimer = 0;
  let bossPulse = 0;
  let bossSlowmoTimer = 0;
  let bossFlashTimer = 0;
  let bossFlashStrength = 0;
  let bossShockwaves = [];
  let comboChain = 0;
  let backToBackTetris = 0;
  let effectStackLevel = 0;
  let borderFlameEnergy = 0;
  let voicePopupText = "";
  let voicePopupTimer = 0;
  let voicePopupColor = "#ffffff";
  let sceneTime = 0;
  let hudLevelFlashTimer = 0;

  function initAudio() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    if (!bgmGain) {
      bgmGain = audioCtx.createGain();
      bgmGain.gain.value = 0.035;
    }
    if (!bgmFilter) {
      bgmFilter = audioCtx.createBiquadFilter();
      bgmFilter.type = "lowpass";
      bgmFilter.frequency.value = 1500;
      bgmFilter.Q.value = 0.9;
    }
    if (!bgmCompressor) {
      bgmCompressor = audioCtx.createDynamicsCompressor();
      bgmCompressor.threshold.value = -22;
      bgmCompressor.knee.value = 18;
      bgmCompressor.ratio.value = 3.4;
      bgmCompressor.attack.value = 0.005;
      bgmCompressor.release.value = 0.16;
    }
    if (bgmGain && bgmFilter && bgmCompressor) {
      bgmGain.disconnect();
      bgmFilter.disconnect();
      bgmCompressor.disconnect();
      bgmGain.connect(bgmFilter);
      bgmFilter.connect(bgmCompressor);
      bgmCompressor.connect(audioCtx.destination);
    }
    ensureVoiceFxChain();
    if (bgmEnabled) {
      startBgm();
    }
  }

  function createImpulseResponse(seconds = 1.2, decay = 2.8) {
    if (!audioCtx) return null;
    const len = Math.max(1, Math.floor(audioCtx.sampleRate * seconds));
    const impulse = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, decay);
        data[i] = (Math.random() * 2 - 1) * env * (0.8 + Math.random() * 0.2);
      }
    }
    return impulse;
  }

  function ensureVoiceFxChain() {
    if (!audioCtx) return;
    if (!voiceBus) voiceBus = audioCtx.createGain();
    if (!voiceDryGain) voiceDryGain = audioCtx.createGain();
    if (!voiceWetGain) voiceWetGain = audioCtx.createGain();
    if (!voiceReverbSend) voiceReverbSend = audioCtx.createGain();
    if (!voiceDelaySend) voiceDelaySend = audioCtx.createGain();
    if (!voiceConvolver) {
      voiceConvolver = audioCtx.createConvolver();
      voiceConvolver.buffer = createImpulseResponse(1.25, 3.2);
    }
    if (!voiceDelay) {
      voiceDelay = audioCtx.createDelay(0.8);
      voiceDelay.delayTime.value = 0.19;
    }
    if (!voiceDelayFeedback) {
      voiceDelayFeedback = audioCtx.createGain();
      voiceDelayFeedback.gain.value = 0.34;
    }
    if (!voicePingSend) voicePingSend = audioCtx.createGain();
    if (!voicePingDelayL) {
      voicePingDelayL = audioCtx.createDelay(0.9);
      voicePingDelayL.delayTime.value = 0.2;
    }
    if (!voicePingDelayR) {
      voicePingDelayR = audioCtx.createDelay(0.9);
      voicePingDelayR.delayTime.value = 0.28;
    }
    if (!voicePingFeedbackL) {
      voicePingFeedbackL = audioCtx.createGain();
      voicePingFeedbackL.gain.value = 0.28;
    }
    if (!voicePingFeedbackR) {
      voicePingFeedbackR = audioCtx.createGain();
      voicePingFeedbackR.gain.value = 0.28;
    }
    if (!voicePingPannerL) {
      voicePingPannerL = audioCtx.createStereoPanner();
      voicePingPannerL.pan.value = -0.8;
    }
    if (!voicePingPannerR) {
      voicePingPannerR = audioCtx.createStereoPanner();
      voicePingPannerR.pan.value = 0.8;
    }

    voiceBus.gain.value = 1;
    voiceDryGain.gain.value = 0.86;
    voiceWetGain.gain.value = 0.32;
    voiceReverbSend.gain.value = 0.42;
    voiceDelaySend.gain.value = 0.3;
    voicePingSend.gain.value = 0.0001;

    voiceBus.disconnect();
    voiceDryGain.disconnect();
    voiceWetGain.disconnect();
    voiceReverbSend.disconnect();
    voiceDelaySend.disconnect();
    voiceConvolver.disconnect();
    voiceDelay.disconnect();
    voiceDelayFeedback.disconnect();
    voicePingSend.disconnect();
    voicePingDelayL.disconnect();
    voicePingDelayR.disconnect();
    voicePingFeedbackL.disconnect();
    voicePingFeedbackR.disconnect();
    voicePingPannerL.disconnect();
    voicePingPannerR.disconnect();

    voiceBus.connect(voiceDryGain);
    voiceDryGain.connect(audioCtx.destination);

    voiceBus.connect(voiceReverbSend);
    voiceReverbSend.connect(voiceConvolver);
    voiceConvolver.connect(voiceWetGain);

    voiceBus.connect(voiceDelaySend);
    voiceDelaySend.connect(voiceDelay);
    voiceDelay.connect(voiceDelayFeedback);
    voiceDelayFeedback.connect(voiceDelay);
    voiceDelay.connect(voiceWetGain);

    // BACK TO BACK! 순간에만 넓어지는 ping-pong stereo bus
    voiceBus.connect(voicePingSend);
    voicePingSend.connect(voicePingDelayL);
    voicePingDelayL.connect(voicePingFeedbackL);
    voicePingFeedbackL.connect(voicePingDelayR);
    voicePingDelayR.connect(voicePingFeedbackR);
    voicePingFeedbackR.connect(voicePingDelayL);
    voicePingDelayL.connect(voicePingPannerL);
    voicePingDelayR.connect(voicePingPannerR);
    voicePingPannerL.connect(voiceWetGain);
    voicePingPannerR.connect(voiceWetGain);

    voiceWetGain.connect(audioCtx.destination);
  }

  function updateVoiceFxModulation() {
    if (!audioCtx) return;
    ensureVoiceFxChain();
    if (!voiceDryGain || !voiceWetGain || !voiceReverbSend || !voiceDelaySend || !voiceDelay || !voiceDelayFeedback || !voicePingSend || !voicePingFeedbackL || !voicePingFeedbackR || !voicePingDelayL || !voicePingDelayR || !voicePingPannerL || !voicePingPannerR) return;

    const profile = getBgmProfile(level);
    const stackNorm = Math.min(1, effectStackLevel / 12);
    const comboNorm = Math.min(1, comboChain / 8);
    const bossBoost = profile.bossStage ? 0.25 : 0;
    const tensionBoost = profile.tensionMode ? 0.2 : 0;
    const flameBoost = Math.min(0.22, borderFlameEnergy * 0.12);
    const climax = Math.min(1, stackNorm * 0.5 + comboNorm * 0.2 + bossBoost + tensionBoost + flameBoost);

    // 클라이맥스가 커질수록 원음은 조금 줄이고 공간계(리버브/딜레이)를 확장합니다.
    const dryTarget = 0.9 - climax * 0.24;
    const wetTarget = 0.24 + climax * 0.42;
    const reverbSendTarget = 0.32 + climax * 0.55;
    const delaySendTarget = 0.16 + climax * 0.5;
    const feedbackTarget = 0.25 + climax * 0.39;
    const delayTimeTarget = 0.145 + climax * 0.14;

    const now = audioCtx.currentTime;
    voiceDryGain.gain.setTargetAtTime(dryTarget, now, 0.08);
    voiceWetGain.gain.setTargetAtTime(wetTarget, now, 0.08);
    voiceReverbSend.gain.setTargetAtTime(reverbSendTarget, now, 0.08);
    voiceDelaySend.gain.setTargetAtTime(delaySendTarget, now, 0.08);
    voiceDelayFeedback.gain.setTargetAtTime(Math.min(0.82, feedbackTarget), now, 0.09);
    voiceDelay.delayTime.setTargetAtTime(delayTimeTarget, now, 0.09);

    // BACK TO BACK! 직후 짧게 stereo ping-pong을 크게 올립니다.
    const chainNorm = Math.min(1, Math.max(0, (voicePingChainLevel - 1) / 6));
    const durationBase = Math.max(400, voicePingBoostDuration);
    const pingBoost = Math.max(0, Math.min(1, voicePingBoostTimer / durationBase));
    const pingSendTarget = 0.0001 + pingBoost * (0.44 + climax * 0.22 + chainNorm * 0.28);
    const pingFeedbackTarget = 0.22 + pingBoost * (0.35 + chainNorm * 0.26);
    const pingLeftTime = 0.155 + pingBoost * (0.065 + chainNorm * 0.05);
    const pingRightTime = 0.225 + pingBoost * (0.09 + chainNorm * 0.07);
    const panWidth = Math.min(1, 0.75 + chainNorm * 0.25);
    voicePingSend.gain.setTargetAtTime(pingSendTarget, now, 0.05);
    voicePingFeedbackL.gain.setTargetAtTime(Math.min(0.85, pingFeedbackTarget), now, 0.06);
    voicePingFeedbackR.gain.setTargetAtTime(Math.min(0.85, pingFeedbackTarget), now, 0.06);
    voicePingDelayL.delayTime.setTargetAtTime(pingLeftTime, now, 0.06);
    voicePingDelayR.delayTime.setTargetAtTime(pingRightTime, now, 0.06);
    voicePingPannerL.pan.setTargetAtTime(-panWidth, now, 0.06);
    voicePingPannerR.pan.setTargetAtTime(panWidth, now, 0.06);
  }

  function playTone({
    freq = 440,
    duration = 0.08,
    type = "square",
    volume = 0.05,
    startOffset = 0,
    endFreq = null
  }) {
    if (!audioCtx || !sfxEnabled) return;
    const now = audioCtx.currentTime + startOffset;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  function playLandingSound() {
    playTone({ freq: 145, endFreq: 85, duration: 0.08, type: "square", volume: 0.06 });
  }

  function playLineClearSound(cleared) {
    const bonus = Math.min(4, cleared);
    playTone({ freq: 420 + bonus * 30, duration: 0.09, type: "triangle", volume: 0.05 });
    playTone({ freq: 620 + bonus * 40, duration: 0.1, type: "triangle", volume: 0.055, startOffset: 0.06 });
    playTone({ freq: 880 + bonus * 50, duration: 0.12, type: "sawtooth", volume: 0.045, startOffset: 0.12 });
  }

  function playTetrisImpactSound() {
    playTone({ freq: 72, endFreq: 48, duration: 0.22, type: "sawtooth", volume: 0.09 });
    playTone({ freq: 96, endFreq: 58, duration: 0.18, type: "square", volume: 0.06, startOffset: 0.03 });
    playTone({ freq: 180, endFreq: 110, duration: 0.11, type: "triangle", volume: 0.05, startOffset: 0.08 });
  }

  function playStackSurgeSound(stackLevel, isTetris, isBackToBack) {
    const s = Math.max(1, Math.min(12, stackLevel));
    const freqBase = 170 + s * 18;
    const vol = Math.min(0.1, 0.04 + s * 0.0048);
    playTone({ freq: freqBase, endFreq: freqBase * 0.78, duration: 0.12, type: "triangle", volume: vol });
    playTone({ freq: freqBase * 1.4, endFreq: freqBase * 1.05, duration: 0.11, type: "square", volume: vol * 0.86, startOffset: 0.035 });
    if (isBackToBack) {
      playTone({ freq: freqBase * 1.95, duration: 0.09, type: "sine", volume: vol * 0.62, startOffset: 0.07 });
    }
    if (isTetris) {
      playTone({ freq: 108 + s * 6, endFreq: 62, duration: 0.2, type: "sawtooth", volume: vol * 0.95, startOffset: 0.02 });
    }
  }

  function playFormantSyllable({
    pitch = 170,
    duration = 0.12,
    startOffset = 0,
    volume = 0.05,
    wave = "sawtooth",
    formants = [700, 1200, 2600],
    endPitch = null,
    vibratoDepth = 5,
    vibratoRate = 5.5,
    pitchJitter = 0.015
  }) {
    if (!audioCtx || !sfxEnabled) return;
    ensureVoiceFxChain();
    const now = audioCtx.currentTime + startOffset;
    const osc = audioCtx.createOscillator();
    const voiceGain = audioCtx.createGain();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();

    osc.type = wave;
    const jitter = 1 + (Math.random() * 2 - 1) * pitchJitter;
    const jitteredStart = Math.max(55, pitch * jitter);
    const jitteredEnd = Math.max(55, (endPitch || pitch) * (1 + (Math.random() * 2 - 1) * pitchJitter));
    osc.frequency.setValueAtTime(jitteredStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, jitteredEnd), now + duration);

    lfo.type = "sine";
    lfo.frequency.setValueAtTime(vibratoRate + Math.random() * 1.2, now);
    lfoGain.gain.setValueAtTime(vibratoDepth + Math.random() * 2.2, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const filters = formants.map((f, idx) => {
      const bp = audioCtx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(f, now);
      bp.Q.value = idx === 0 ? 7 : 9;
      return bp;
    });

    const mix = audioCtx.createGain();
    mix.gain.value = 0.42;
    osc.connect(voiceGain);
    for (const f of filters) {
      voiceGain.connect(f);
      f.connect(mix);
    }
    mix.connect(voiceBus || audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
    lfo.start(now);
    lfo.stop(now + duration + 0.03);
  }

  function playConsonantBurst({
    startOffset = 0,
    duration = 0.035,
    volume = 0.04,
    hpFreq = 1200
  }) {
    if (!audioCtx || !sfxEnabled) return;
    ensureVoiceFxChain();
    const now = audioCtx.currentTime + startOffset;
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const src = audioCtx.createBufferSource();
    const hp = audioCtx.createBiquadFilter();
    const bp = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(hpFreq, now);
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(hpFreq * 1.4, now);
    bp.Q.value = 1.4;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.buffer = buffer;
    src.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(voiceBus || audioCtx.destination);
    src.start(now);
    src.stop(now + duration + 0.01);
  }

  function getVoiceFormants(vowel) {
    const table = {
      a: [800, 1150, 2900],
      e: [500, 1850, 2500],
      i: [300, 2200, 3000],
      o: [450, 900, 2600],
      u: [350, 700, 2400],
      uh: [600, 1250, 2450]
    };
    return table[vowel] || table.uh;
  }

  function playVoiceCueSound(cueType = "combo") {
    if (cueType === "unstoppable") {
      // 더 저음/웅장한 announcer 스타일
      playConsonantBurst({ startOffset: 0.0, duration: 0.036, volume: 0.028, hpFreq: 1300 });
      playFormantSyllable({ pitch: 132, endPitch: 112, duration: 0.17, volume: 0.068, wave: "triangle", formants: getVoiceFormants("u"), startOffset: 0.012, vibratoDepth: 4.2, vibratoRate: 4.4, pitchJitter: 0.01 });
      playConsonantBurst({ startOffset: 0.11, duration: 0.03, volume: 0.023, hpFreq: 1800 });
      playFormantSyllable({ pitch: 146, endPitch: 122, duration: 0.16, volume: 0.063, wave: "triangle", formants: getVoiceFormants("o"), startOffset: 0.12, vibratoDepth: 4.8, vibratoRate: 4.9, pitchJitter: 0.012 });
      playConsonantBurst({ startOffset: 0.225, duration: 0.028, volume: 0.022, hpFreq: 2100 });
      playFormantSyllable({ pitch: 154, endPitch: 130, duration: 0.15, volume: 0.062, wave: "sawtooth", formants: getVoiceFormants("a"), startOffset: 0.235, vibratoDepth: 5.1, vibratoRate: 5.1, pitchJitter: 0.012 });
      playTone({ freq: 84, endFreq: 62, duration: 0.24, type: "sine", volume: 0.042, startOffset: 0.02 });
      return;
    }

    if (cueType === "rampage") {
      // 거칠고 공격적인 스타일
      playConsonantBurst({ startOffset: 0.0, duration: 0.038, volume: 0.032, hpFreq: 2500 });
      playFormantSyllable({ pitch: 186, endPitch: 158, duration: 0.115, volume: 0.064, wave: "sawtooth", formants: getVoiceFormants("a"), startOffset: 0.01, vibratoDepth: 6.6, vibratoRate: 7.6, pitchJitter: 0.02 });
      playConsonantBurst({ startOffset: 0.09, duration: 0.028, volume: 0.028, hpFreq: 2800 });
      playFormantSyllable({ pitch: 202, endPitch: 170, duration: 0.11, volume: 0.062, wave: "square", formants: getVoiceFormants("e"), startOffset: 0.098, vibratoDepth: 7.2, vibratoRate: 8.2, pitchJitter: 0.02 });
      playConsonantBurst({ startOffset: 0.18, duration: 0.026, volume: 0.026, hpFreq: 3000 });
      playFormantSyllable({ pitch: 214, endPitch: 182, duration: 0.106, volume: 0.061, wave: "sawtooth", formants: getVoiceFormants("a"), startOffset: 0.188, vibratoDepth: 7.6, vibratoRate: 8.8, pitchJitter: 0.022 });
      return;
    }

    if (cueType === "dominating") {
      // 중저역 중심의 단단한 announcer 스타일
      playConsonantBurst({ startOffset: 0.0, duration: 0.032, volume: 0.026, hpFreq: 1600 });
      playFormantSyllable({ pitch: 154, endPitch: 136, duration: 0.14, volume: 0.062, wave: "triangle", formants: getVoiceFormants("o"), startOffset: 0.01, vibratoDepth: 4.6, vibratoRate: 5.2, pitchJitter: 0.012 });
      playConsonantBurst({ startOffset: 0.1, duration: 0.026, volume: 0.022, hpFreq: 2000 });
      playFormantSyllable({ pitch: 166, endPitch: 146, duration: 0.128, volume: 0.058, wave: "triangle", formants: getVoiceFormants("uh"), startOffset: 0.11, vibratoDepth: 5, vibratoRate: 5.6, pitchJitter: 0.012 });
      playConsonantBurst({ startOffset: 0.19, duration: 0.024, volume: 0.021, hpFreq: 2200 });
      playFormantSyllable({ pitch: 176, endPitch: 154, duration: 0.12, volume: 0.057, wave: "sawtooth", formants: getVoiceFormants("o"), startOffset: 0.2, vibratoDepth: 5.4, vibratoRate: 5.9, pitchJitter: 0.013 });
      playTone({ freq: 96, endFreq: 74, duration: 0.18, type: "sine", volume: 0.03, startOffset: 0.03 });
      return;
    }

    if (cueType === "b2b") {
      // "Back to back"에 가까운 음절형 포먼트 신스
      playConsonantBurst({ startOffset: 0.0, duration: 0.03, volume: 0.026, hpFreq: 1600 }); // b
      playFormantSyllable({ pitch: 155, endPitch: 132, duration: 0.14, volume: 0.06, formants: getVoiceFormants("a"), startOffset: 0.01, vibratoDepth: 4.8, vibratoRate: 5.4 });
      playConsonantBurst({ startOffset: 0.08, duration: 0.026, volume: 0.022, hpFreq: 2300 }); // k
      playFormantSyllable({ pitch: 170, endPitch: 145, duration: 0.1, volume: 0.045, formants: getVoiceFormants("uh"), startOffset: 0.09, vibratoDepth: 4.2, vibratoRate: 6.1 });
      playConsonantBurst({ startOffset: 0.17, duration: 0.024, volume: 0.022, hpFreq: 2600 }); // t
      playFormantSyllable({ pitch: 182, endPitch: 152, duration: 0.11, volume: 0.05, formants: getVoiceFormants("u"), startOffset: 0.185, vibratoDepth: 5.1, vibratoRate: 6.4 });
      playConsonantBurst({ startOffset: 0.26, duration: 0.03, volume: 0.027, hpFreq: 1700 }); // b
      playFormantSyllable({ pitch: 168, endPitch: 140, duration: 0.13, volume: 0.058, formants: getVoiceFormants("a"), startOffset: 0.275, vibratoDepth: 5.4, vibratoRate: 5.8 });
      playConsonantBurst({ startOffset: 0.35, duration: 0.024, volume: 0.022, hpFreq: 2500 }); // k
      playFormantSyllable({ pitch: 210, endPitch: 176, duration: 0.11, volume: 0.05, formants: getVoiceFormants("e"), startOffset: 0.36, vibratoDepth: 6.2, vibratoRate: 6.9 });
      return;
    }

    // "Combo"에 가까운 음절형 포먼트 신스
    playConsonantBurst({ startOffset: 0.0, duration: 0.028, volume: 0.024, hpFreq: 1900 }); // k
    playFormantSyllable({ pitch: 190, endPitch: 170, duration: 0.12, volume: 0.055, formants: getVoiceFormants("o"), startOffset: 0.008, vibratoDepth: 4.8, vibratoRate: 5.7 });
    playConsonantBurst({ startOffset: 0.082, duration: 0.022, volume: 0.02, hpFreq: 1700 }); // m
    playFormantSyllable({ pitch: 174, endPitch: 152, duration: 0.11, volume: 0.05, formants: getVoiceFormants("uh"), startOffset: 0.09, vibratoDepth: 5.2, vibratoRate: 6.2 });
    playConsonantBurst({ startOffset: 0.168, duration: 0.025, volume: 0.021, hpFreq: 2400 }); // b
    playFormantSyllable({ pitch: 205, endPitch: 180, duration: 0.13, volume: 0.055, formants: getVoiceFormants("o"), startOffset: 0.185, vibratoDepth: 5.8, vibratoRate: 6.6 });
  }

  function getB2BAnnouncement(count) {
    if (count >= 6) {
      return { text: "UNSTOPPABLE!", color: "#ff6ae6", duration: 1280, isBackToBackCue: true };
    }
    if (count >= 5) {
      return { text: `DOMINATING x${count}!`, color: "#ff8a5b", duration: 1220, isBackToBackCue: true };
    }
    if (count >= 4) {
      return { text: `RAMPAGE x${count}!`, color: "#ffb347", duration: 1180, isBackToBackCue: true };
    }
    if (count >= 3) {
      return { text: "BACK TO BACK x3!", color: "#ffd166", duration: 1140, isBackToBackCue: true };
    }
    return { text: "BACK TO BACK!", color: "#ffd166", duration: 1100, isBackToBackCue: true };
  }

  function getVoiceCueTypeByText(text, isBackToBackCue) {
    if (text.includes("UNSTOPPABLE")) return "unstoppable";
    if (text.includes("RAMPAGE")) return "rampage";
    if (text.includes("DOMINATING")) return "dominating";
    if (isBackToBackCue || text.includes("BACK TO BACK")) return "b2b";
    return "combo";
  }

  function playLevelUpSound() {
    playTone({ freq: 520, duration: 0.09, type: "triangle", volume: 0.05 });
    playTone({ freq: 780, duration: 0.1, type: "triangle", volume: 0.05, startOffset: 0.07 });
    playTone({ freq: 1040, duration: 0.12, type: "sine", volume: 0.045, startOffset: 0.14 });
  }

  function playGameOverSound() {
    playTone({ freq: 360, endFreq: 210, duration: 0.22, type: "sawtooth", volume: 0.06 });
    playTone({ freq: 240, endFreq: 120, duration: 0.28, type: "square", volume: 0.055, startOffset: 0.12 });
  }

  function playGameClearSound() {
    playTone({ freq: 520, duration: 0.12, type: "triangle", volume: 0.07 });
    playTone({ freq: 780, duration: 0.12, type: "triangle", volume: 0.07, startOffset: 0.1 });
    playTone({ freq: 1040, duration: 0.14, type: "triangle", volume: 0.07, startOffset: 0.2 });
    playTone({ freq: 1320, duration: 0.2, type: "sine", volume: 0.08, startOffset: 0.32 });
  }

  function startBgm() {
    if (!audioCtx || !bgmEnabled) return;
    if (!bgmGain) {
      bgmGain = audioCtx.createGain();
      bgmGain.gain.value = 0.035;
      bgmGain.connect(audioCtx.destination);
    }
    if (!bgmStarted) {
      bgmStarted = true;
      bgmStep = 0;
      bgmNextNoteTime = audioCtx.currentTime + 0.03;
    }
  }

  function stopBgm() {
    bgmStarted = false;
  }

  function getBgmProfile(targetLevel) {
    const clampedLevel = Math.max(1, Math.min(MAX_LEVEL, targetLevel));
    const stage = getStageByLevel(clampedLevel);
    const inStage = (clampedLevel - 1) % 5;
    const tensionMode = clampedLevel >= 45;
    const bossStage = stage === 10;

    // Stage가 올라갈수록 템포를 올리고, 같은 Stage 내에서도 미세하게 가속합니다.
    let bpm = 104 + (stage - 1) * 7 + inStage * 1.6;
    if (bossStage) bpm += 9;
    if (tensionMode) bpm += 18 + (clampedLevel - 45) * 2.8;
    bpm = Math.min(228, bpm);

    const beat = 60 / bpm;
    const swing = Math.min(0.18, 0.08 + (stage - 1) * 0.006 + (tensionMode ? 0.025 : 0));
    const harmonyEnabled = stage >= 3;
    const arpeggioEnabled = stage >= 5;
    const syncopationEnabled = stage >= 7;
    const accentEnabled = stage >= 9;

    return {
      stage,
      beat,
      swing,
      bpm,
      tensionMode,
      bossStage,
      harmonyEnabled,
      arpeggioEnabled,
      syncopationEnabled,
      accentEnabled
    };
  }

  function scheduleBgmNote(freq, when, duration = 0.2, wave = "triangle", volume = 0.06) {
    if (!audioCtx || !bgmGain || !bgmEnabled) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(bgmGain);
    osc.start(when);
    osc.stop(when + duration + 0.01);
  }

  function updateBgm() {
    if (!audioCtx) return;
    if (!bgmEnabled || !bgmStarted) return;

    const profile = getBgmProfile(level);
    const scaleA = [220, 247, 262, 294, 330, 349, 392, 440];
    const scaleB = [196, 220, 247, 262, 294, 330, 370, 392];
    const section = Math.floor(bgmStep / 16) % 2;
    const scale = section === 0 ? scaleA : scaleB;
    const pattern = [0, 2, 4, 6, 4, 2, 1, 3, 5, 4, 2, 0, 1, 3, 2, 0];
    const bossScale = [147, 165, 175, 196, 220, 247, 262, 294];
    const bossPattern = [0, 0, 2, 3, 4, 3, 2, 1, 0, 2, 4, 5, 6, 5, 4, 2];
    const lookAhead = 0.28;

    // Stage가 높아질수록 루프 볼륨도 살짝 올려 에너지를 강화합니다.
    if (bgmGain) {
      const targetGain = 0.026 + (profile.stage - 1) * 0.0031 + (profile.tensionMode ? 0.006 : 0);
      bgmGain.gain.setTargetAtTime(Math.min(0.06, targetGain), audioCtx.currentTime, 0.08);
    }
    if (bgmFilter) {
      const pulse = 0.5 + 0.5 * Math.sin(audioCtx.currentTime * (profile.tensionMode ? 8 : 3.2));
      if (profile.tensionMode) {
        bgmFilter.type = "bandpass";
        bgmFilter.frequency.setTargetAtTime(900 + pulse * 2400, audioCtx.currentTime, 0.05);
        bgmFilter.Q.setTargetAtTime(3.2 + pulse * 6.5, audioCtx.currentTime, 0.05);
      } else {
        bgmFilter.type = "lowpass";
        bgmFilter.frequency.setTargetAtTime(1200 + profile.stage * 150, audioCtx.currentTime, 0.08);
        bgmFilter.Q.setTargetAtTime(0.9 + profile.stage * 0.08, audioCtx.currentTime, 0.08);
      }
    }

    while (bgmNextNoteTime < audioCtx.currentTime + lookAhead) {
      const stepInBar = bgmStep % 16;
      const idx = profile.bossStage ? bossPattern[stepInBar] : pattern[stepInBar];
      const baseFreq = (profile.bossStage ? bossScale : scale)[idx];

      const isOffBeat = stepInBar % 2 === 1;
      const microShift = isOffBeat ? profile.beat * profile.swing * 0.35 : 0;
      const noteTime = bgmNextNoteTime + microShift;
      const noteDur = profile.beat * (isOffBeat ? 0.62 : 0.78);

      if (profile.bossStage) {
        scheduleBgmNote(baseFreq, noteTime, noteDur * 0.9, "sawtooth", 0.05);
        scheduleBgmNote(baseFreq * 2, noteTime + profile.beat * 0.08, profile.beat * 0.24, "square", 0.016);
      } else {
        scheduleBgmNote(baseFreq, noteTime, noteDur, "triangle", 0.048);
      }

      // 저역 루트 레이어
      if (stepInBar % 4 === 0 || (profile.bossStage && stepInBar % 2 === 0)) {
        scheduleBgmNote(Math.max(82, baseFreq / 2), bgmNextNoteTime, profile.beat * 0.92, "sawtooth", profile.bossStage ? 0.037 : 0.03);
      }

      // 중반 이후부터 3도 화음 레이어 추가
      if (profile.harmonyEnabled && stepInBar % 2 === 0) {
        scheduleBgmNote(baseFreq * (profile.bossStage ? 1.1892 : 1.2599), noteTime + 0.003, noteDur * 0.9, "sine", profile.bossStage ? 0.026 : 0.02);
      }

      // 고레벨에서 아르페지오 텍스처 추가
      if (profile.arpeggioEnabled && stepInBar % 4 !== 3) {
        scheduleBgmNote(baseFreq * 2, noteTime + profile.beat * 0.17, profile.beat * 0.28, "square", profile.tensionMode ? 0.02 : 0.014);
      }

      // 상위 Stage에서 싱코페이션 타격감 추가
      if (profile.syncopationEnabled && stepInBar % 8 === 3) {
        scheduleBgmNote(baseFreq * 1.5, noteTime + profile.beat * 0.2, profile.beat * 0.22, "triangle", profile.tensionMode ? 0.024 : 0.018);
      }

      // 최상위 Stage에서는 강세 비트 추가
      if (profile.accentEnabled && stepInBar % 8 === 0) {
        scheduleBgmNote(Math.max(120, baseFreq / 1.5), noteTime, profile.beat * 0.16, "square", profile.bossStage ? 0.034 : 0.026);
      }

      // 레벨 45+ 긴장 모드에서 서브 펄스 추가 (심장박동 같은 압박감)
      if (profile.tensionMode && stepInBar % 4 === 2) {
        scheduleBgmNote(96, noteTime, profile.beat * 0.2, "square", 0.028);
      }

      const stepBeat = isOffBeat ? profile.beat * (1 + profile.swing) : profile.beat * (1 - profile.swing);
      bgmNextNoteTime += Math.max(0.08, stepBeat);
      bgmStep++;
    }
  }

  function toggleSfx() {
    sfxEnabled = !sfxEnabled;
  }

  function toggleBgm() {
    bgmEnabled = !bgmEnabled;
    if (bgmEnabled) {
      initAudio();
      startBgm();
    } else {
      stopBgm();
    }
  }

  function triggerGameClear() {
    gameCleared = true;
    clearFxTimer = 0;
    playGameClearSound();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) {
          spawnShatter(x, y, board[y][x], 14);
        }
      }
    }
  }

  function getStageByLevel(targetLevel) {
    return Math.min(10, Math.max(1, Math.ceil(targetLevel / 5)));
  }

  function getDropIntervalByLevel(targetLevel) {
    const clampedLevel = Math.max(1, Math.min(MAX_LEVEL, targetLevel));
    const stage = getStageByLevel(clampedLevel);
    const stageBase = STAGE_INTERVALS[stage - 1];
    const inStageStep = (clampedLevel - 1) % 5;
    return Math.max(90, stageBase - inStageStep * 22);
  }

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function randomType() {
    const keys = Object.keys(SHAPES);
    return keys[(Math.random() * keys.length) | 0];
  }

  function spawnPiece() {
    const type = randomType();
    const shape = SHAPES[type].map((r) => [...r]);
    return {
      type,
      shape,
      color: NEON_COLORS[(Math.random() * NEON_COLORS.length) | 0],
      x: ((COLS - shape[0].length) / 2) | 0,
      y: -1
    };
  }

  function rotate(shape) {
    const rows = shape.length;
    const cols = shape[0].length;
    const out = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        out[x][rows - 1 - y] = shape[y][x];
      }
    }
    return out;
  }

  function collide(px, py, shape) {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const nx = px + x;
        const ny = py + y;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function mergePiece() {
    for (let y = 0; y < current.shape.length; y++) {
      for (let x = 0; x < current.shape[y].length; x++) {
        if (!current.shape[y][x]) continue;
        const by = current.y + y;
        const bx = current.x + x;
        if (by >= 0) {
          board[by][bx] = current.color;
          spawnImpactBurst(bx, by, current.color, 8, 1.8);
        }
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    const prevLevel = level;
    const clearedRows = [];
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(Boolean)) {
        const snapshot = [...board[y]];
        clearedRows.push({ y, snapshot });
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += [0, 120, 300, 550, 900][cleared] * level;
      level = Math.min(MAX_LEVEL, 1 + ((lines / LINES_PER_LEVEL) | 0));
    }
    const reachedMaxLevel = prevLevel < MAX_LEVEL && level >= MAX_LEVEL;
    return { cleared, leveledUp: level > prevLevel, reachedMaxLevel, clearedRows };
  }

  function hardDrop() {
    if (gameOver) return;
    while (!collide(current.x, current.y + 1, current.shape)) {
      current.y++;
      score += 2;
    }
    lockPiece();
  }

  function lockPiece() {
    if (gameCleared) return;
    mergePiece();
    const result = clearLines();
    playLandingSound();
    if (result.cleared > 0) {
      comboChain += 1;
      if (result.cleared === 4) {
        backToBackTetris = backToBackTetris > 0 ? backToBackTetris + 1 : 1;
      } else {
        backToBackTetris = 0;
      }
      effectStackLevel = Math.min(
        12,
        Math.max(1, comboChain - 1) + (result.cleared === 4 ? 2 : 0) + backToBackTetris * 2
      );
      if (effectStackLevel >= 4) {
        borderFlameEnergy = Math.min(1.8, borderFlameEnergy + 0.32 + effectStackLevel * 0.08);
      }
      if (backToBackTetris >= 2 && result.cleared === 4) {
        const b2bLine = getB2BAnnouncement(backToBackTetris);
        triggerVoicePopup(b2bLine.text, b2bLine.color, b2bLine.duration, true, backToBackTetris, b2bLine.isBackToBackCue);
      } else {
        const praise = getComboPraise(comboChain);
        const label = comboChain >= 2 ? ` 콤보 x${comboChain}` : "";
        triggerVoicePopup(`${praise.text}${label}`, praise.color, praise.duration, comboChain >= 4);
      }
      triggerComboBreakEffect(result.clearedRows, result.cleared);
      playLineClearSound(result.cleared);
      triggerBossLineCinematic(result.cleared, effectStackLevel, backToBackTetris >= 2);
    } else {
      comboChain = 0;
      backToBackTetris = 0;
      effectStackLevel = 0;
      borderFlameEnergy = Math.max(0, borderFlameEnergy - 0.24);
    }
    if (result.leveledUp) {
      playLevelUpSound();
      hudLevelFlashTimer = 420;
    }
    if (result.reachedMaxLevel) {
      triggerGameClear();
      return;
    }
    current = next;
    next = spawnPiece();
    lockTimer = 0;
    if (collide(current.x, current.y, current.shape)) {
      gameOver = true;
      playGameOverSound();
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (board[y][x]) {
            spawnShatter(x, y, board[y][x], 8);
          }
        }
      }
    }
  }

  function triggerComboBreakEffect(clearedRows, clearedCount) {
    if (!clearedRows || !clearedRows.length) return;
    const comboBoost = Math.max(0, comboChain - 1);
    const stackBoost = Math.max(0, effectStackLevel);
    const isCritical = clearedCount >= 4;
    const density = 10 + clearedCount * 2;

    for (const row of clearedRows) {
      for (let x = 0; x < COLS; x++) {
        const color = row.snapshot[x];
        if (!color) continue;
        spawnShatter(x, row.y, color, density, {
          combo: comboBoost,
          stack: stackBoost,
          critical: isCritical
        });
        spawnThickFlameBurst(x, row.y, color, {
          combo: comboBoost,
          stack: stackBoost,
          critical: isCritical
        });
      }
    }
  }

  function getComboPraise(chain) {
    if (chain >= 12) return { text: "전설적인", color: "#ffd700", duration: 1100 };
    if (chain >= 10) return { text: "경이로운", color: "#ff8aff", duration: 1060 };
    if (chain >= 8) return { text: "압도적인", color: "#ff6ae6", duration: 1020 };
    if (chain >= 6) return { text: "대단히 좋음", color: "#ffa96b", duration: 980 };
    if (chain >= 5) return { text: "완전 좋은", color: "#8dffef", duration: 940 };
    if (chain >= 4) return { text: "아주좋은", color: "#b4ff8a", duration: 900 };
    if (chain >= 3) return { text: "좋은", color: "#c8f0ff", duration: 860 };
    if (chain >= 2) return { text: "VERY GREAT", color: "#aee4ff", duration: 820 };
    return { text: "GREAT", color: "#d0eaff", duration: 760 };
  }

  function tryMove(dx, dy) {
    if (gameOver || gameCleared) return false;
    const nx = current.x + dx;
    const ny = current.y + dy;
    if (!collide(nx, ny, current.shape)) {
      current.x = nx;
      current.y = ny;
      return true;
    }
    return false;
  }

  function tryRotate() {
    if (gameOver || gameCleared) return;
    const rotated = rotate(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collide(current.x + k, current.y, rotated)) {
        current.shape = rotated;
        current.x += k;
        return;
      }
    }
  }

  function resetGame() {
    board = createBoard();
    current = spawnPiece();
    next = spawnPiece();
    score = 0;
    level = 1;
    lines = 0;
    gameOver = false;
    gameCleared = false;
    particles = [];
    dropCounter = 0;
    lockTimer = 0;
    clearFxTimer = 0;
    cameraShakeX = 0;
    cameraShakeY = 0;
    cameraShakePhase = 0;
    glitchTimer = 0;
    bossPulse = 0;
    bossSlowmoTimer = 0;
    bossFlashTimer = 0;
    bossFlashStrength = 0;
    bossShockwaves = [];
    comboChain = 0;
    backToBackTetris = 0;
    effectStackLevel = 0;
    borderFlameEnergy = 0;
    voicePopupText = "";
    voicePopupTimer = 0;
    voicePopupColor = "#ffffff";
    voicePingBoostTimer = 0;
    voicePingBoostDuration = 650;
    voicePingChainLevel = 0;
    hudLevelFlashTimer = 0;
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const maxCellW = (canvas.width * 0.5) / COLS;
    const maxCellH = (canvas.height * 0.88) / ROWS;
    cell = Math.max(16, Math.floor(Math.min(maxCellW, maxCellH)));
    boardWidth = cell * COLS;
    boardHeight = cell * ROWS;
    boardX = Math.floor((canvas.width - boardWidth) / 2);
    boardY = Math.floor((canvas.height - boardHeight) / 2);
  }

  function neonRect(x, y, w, h, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = Math.max(8, cell * 0.45);
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function drawCell(gx, gy, color, alpha = 1) {
    const x = boardX + gx * cell;
    const y = boardY + gy * cell;
    neonRect(x + 1, y + 1, cell - 2, cell - 2, color, alpha);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = Math.max(1, cell * 0.06);
    ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
    ctx.restore();
  }

  function drawGrid() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(boardX - 10, boardY - 10, boardWidth + 20, boardHeight + 20);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(120,130,255,0.12)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      const px = boardX + x * cell;
      ctx.beginPath();
      ctx.moveTo(px, boardY);
      ctx.lineTo(px, boardY + boardHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      const py = boardY + y * cell;
      ctx.beginPath();
      ctx.moveTo(boardX, py);
      ctx.lineTo(boardX + boardWidth, py);
      ctx.stroke();
    }
    ctx.restore();

    // 보드 외곽 발광 프레임으로 무대 중심감을 강화
    ctx.save();
    ctx.shadowBlur = 28;
    ctx.shadowColor = "rgba(120, 220, 255, 0.5)";
    ctx.strokeStyle = "rgba(120, 220, 255, 0.42)";
    ctx.lineWidth = Math.max(2, cell * 0.08);
    ctx.strokeRect(boardX - 4, boardY - 4, boardWidth + 8, boardHeight + 8);
    ctx.restore();
  }

  function drawGrandBackdrop() {
    const t = sceneTime * 0.001;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.45;

    // 중심 오라
    const aura = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(canvas.width, canvas.height) * 0.8);
    aura.addColorStop(0, "rgba(60, 110, 255, 0.2)");
    aura.addColorStop(0.45, "rgba(40, 20, 90, 0.1)");
    aura.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.save();
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // 무대 라이트 기둥
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const beams = 6;
    for (let i = 0; i < beams; i++) {
      const phase = t * (0.48 + i * 0.06) + i * 0.9;
      const bx = canvas.width * (0.12 + (i / (beams - 1)) * 0.76) + Math.sin(phase) * 24;
      const bw = canvas.width * 0.05 + Math.sin(phase * 1.7) * 8;
      const grad = ctx.createLinearGradient(bx, 0, bx, canvas.height);
      grad.addColorStop(0, "rgba(130,180,255,0.16)");
      grad.addColorStop(0.35, "rgba(110,90,255,0.09)");
      grad.addColorStop(1, "rgba(20,10,30,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx - bw, 0);
      ctx.lineTo(bx + bw, 0);
      ctx.lineTo(bx + bw * 0.16, canvas.height);
      ctx.lineTo(bx - bw * 0.16, canvas.height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 상단 헤일로
    ctx.save();
    const halo = ctx.createRadialGradient(
      canvas.width * 0.5,
      -canvas.height * 0.18,
      canvas.width * 0.08,
      canvas.width * 0.5,
      -canvas.height * 0.18,
      canvas.width * 0.7
    );
    halo.addColorStop(0, "rgba(255,220,170,0.28)");
    halo.addColorStop(0.42, "rgba(120,140,255,0.12)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function drawCinematicOverlay() {
    // 아주 약한 필름 그레인/스캔으로 장면 깊이 강화
    const t = sceneTime * 0.001;
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "rgba(180,190,255,0.3)";
    for (let y = 0; y < canvas.height; y += 4) {
      const jitter = Math.sin(t * 9 + y * 0.04) * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y + jitter);
      ctx.lineTo(canvas.width, y + jitter);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoard() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const color = board[y][x];
        if (color) drawCell(x, y, color, 0.92);
      }
    }
  }

  function drawGhost() {
    let gy = current.y;
    while (!collide(current.x, gy + 1, current.shape)) gy++;
    for (let y = 0; y < current.shape.length; y++) {
      for (let x = 0; x < current.shape[y].length; x++) {
        if (!current.shape[y][x]) continue;
        const by = gy + y;
        if (by < 0) continue;
        drawCell(current.x + x, by, current.color, 0.18);
      }
    }
  }

  function drawCurrent() {
    for (let y = 0; y < current.shape.length; y++) {
      for (let x = 0; x < current.shape[y].length; x++) {
        if (!current.shape[y][x]) continue;
        const by = current.y + y;
        if (by < 0) continue;
        drawCell(current.x + x, by, current.color, 1);
      }
    }
  }

  function drawHud() {
    const panelW = Math.max(280, canvas.width * 0.22);
    const panelH = Math.max(390, canvas.height * 0.5);
    const px = boardX + boardWidth + Math.min(40, canvas.width * 0.03);
    const py = boardY;
    const profile = getBgmProfile(level);
    const flashN = Math.max(0, Math.min(1, hudLevelFlashTimer / 420));

    ctx.save();
    const panelGrad = ctx.createLinearGradient(px, py, px, py + panelH);
    panelGrad.addColorStop(0, "rgba(10, 18, 38, 0.84)");
    panelGrad.addColorStop(0.55, "rgba(6, 10, 26, 0.8)");
    panelGrad.addColorStop(1, "rgba(4, 8, 20, 0.9)");
    ctx.fillStyle = panelGrad;
    ctx.fillRect(px, py, panelW, panelH);
    ctx.shadowBlur = 24;
    ctx.shadowColor = "rgba(120, 200, 255, 0.22)";
    const frameGrad = ctx.createLinearGradient(px, py, px + panelW, py + panelH);
    frameGrad.addColorStop(0, "rgba(246, 208, 132, 0.75)");
    frameGrad.addColorStop(0.45, "rgba(176, 210, 255, 0.62)");
    frameGrad.addColorStop(1, "rgba(255, 168, 92, 0.72)");
    ctx.strokeStyle = frameGrad;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(px, py, panelW, panelH);
    ctx.restore();

    // 왕관형 프레임 장식
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = "rgba(250, 212, 130, 0.9)";
    ctx.lineWidth = 1.5;
    const crownY = py - 10;
    ctx.beginPath();
    ctx.moveTo(px + panelW * 0.18, crownY + 8);
    ctx.lineTo(px + panelW * 0.29, crownY - 8);
    ctx.lineTo(px + panelW * 0.42, crownY + 8);
    ctx.lineTo(px + panelW * 0.5, crownY - 12);
    ctx.lineTo(px + panelW * 0.58, crownY + 8);
    ctx.lineTo(px + panelW * 0.71, crownY - 8);
    ctx.lineTo(px + panelW * 0.82, crownY + 8);
    ctx.stroke();
    ctx.restore();

    // 타이틀 금속광
    ctx.save();
    const metal = ctx.createLinearGradient(px + 12, py + 8, px + panelW - 12, py + 42);
    metal.addColorStop(0, "#f4d48a");
    metal.addColorStop(0.35, "#fff1ce");
    metal.addColorStop(0.7, "#a9c7ff");
    metal.addColorStop(1, "#f2a869");
    ctx.fillStyle = metal;
    ctx.font = `bold ${Math.max(20, cell * 0.64)}px Segoe UI`;
    ctx.fillText("NEON TETRIS", px + 16, py + 36);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(px + 16, py + 17, panelW * 0.48, Math.max(2, cell * 0.06));
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#ddf5ff";
    ctx.font = `${Math.max(14, cell * 0.45)}px Segoe UI`;
    ctx.fillText(`점수  ${score}`, px + 16, py + 68);
    ctx.fillText(`레벨  ${level}`, px + 16, py + 95);
    ctx.fillText(`라인  ${lines}`, px + 16, py + 122);
    ctx.fillText(`단계  ${getStageByLevel(level)} / 10`, px + 16, py + 149);
    ctx.fillText(`효과음  ${sfxEnabled ? "ON" : "OFF"} (M)`, px + 16, py + 176);
    ctx.fillText(`BGM    ${bgmEnabled ? "ON" : "OFF"} (B)`, px + 16, py + 203);
    ctx.fillText(`BPM    ${Math.round(profile.bpm)}`, px + 16, py + 230);
    ctx.fillText(`테마   ${profile.bossStage ? "BOSS STAGE 10" : "NORMAL"}`, px + 16, py + 257);
    ctx.fillText(`모드   ${profile.tensionMode ? "TENSION 45+" : "STABLE"}`, px + 16, py + 284);
    ctx.fillText(`FX     ${profile.bossStage ? "GLITCH/VIGNETTE/SHAKE" : "OFF"}`, px + 16, py + 311);
    ctx.fillText(`COMBO  x${comboChain}`, px + 16, py + 338);
    ctx.fillText(`B2B-T  x${backToBackTetris}`, px + 16, py + 365);
    ctx.fillText(`STACK  ${effectStackLevel}`, px + 16, py + 392);
    ctx.fillText("조작: ← → ↓ / ↑ 회전 / Space 하드드롭", px + 16, py + panelH - 38);
    ctx.fillText("재시작: R", px + 16, py + panelH - 14);
    ctx.restore();

    // 레벨업 순간 패널 플래시
    if (flashN > 0) {
      ctx.save();
      const fAlpha = flashN * 0.5;
      const flashGrad = ctx.createLinearGradient(px, py, px, py + panelH);
      flashGrad.addColorStop(0, `rgba(255,245,190,${fAlpha})`);
      flashGrad.addColorStop(0.35, `rgba(170,210,255,${fAlpha * 0.55})`);
      flashGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = flashGrad;
      ctx.fillRect(px, py, panelW, panelH);
      ctx.strokeStyle = `rgba(255,232,162,${Math.min(0.9, fAlpha * 1.4)})`;
      ctx.lineWidth = 2.2;
      ctx.strokeRect(px - 1, py - 1, panelW + 2, panelH + 2);
      ctx.restore();
    }

    drawNextPanel(px, py + panelH + 14, panelW, Math.max(140, panelH * 0.65));
  }

  function drawNextPanel(px, py, w, h) {
    ctx.save();
    const panelGrad = ctx.createLinearGradient(px, py, px, py + h);
    panelGrad.addColorStop(0, "rgba(10, 18, 38, 0.82)");
    panelGrad.addColorStop(0.6, "rgba(6, 12, 28, 0.78)");
    panelGrad.addColorStop(1, "rgba(5, 10, 22, 0.88)");
    ctx.fillStyle = panelGrad;
    ctx.fillRect(px, py, w, h);
    const frameGrad = ctx.createLinearGradient(px, py, px + w, py + h);
    frameGrad.addColorStop(0, "rgba(246, 208, 132, 0.72)");
    frameGrad.addColorStop(0.45, "rgba(176, 210, 255, 0.58)");
    frameGrad.addColorStop(1, "rgba(255, 168, 92, 0.68)");
    ctx.shadowBlur = 20;
    ctx.shadowColor = "rgba(120, 200, 255, 0.2)";
    ctx.strokeStyle = frameGrad;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(px, py, w, h);
    ctx.restore();

    // 왕관형 상단 장식
    ctx.save();
    ctx.globalAlpha = 0.66;
    ctx.strokeStyle = "rgba(250, 212, 130, 0.86)";
    ctx.lineWidth = 1.25;
    const crownY = py - 7;
    ctx.beginPath();
    ctx.moveTo(px + w * 0.2, crownY + 6);
    ctx.lineTo(px + w * 0.31, crownY - 6);
    ctx.lineTo(px + w * 0.44, crownY + 6);
    ctx.lineTo(px + w * 0.5, crownY - 9);
    ctx.lineTo(px + w * 0.56, crownY + 6);
    ctx.lineTo(px + w * 0.69, crownY - 6);
    ctx.lineTo(px + w * 0.8, crownY + 6);
    ctx.stroke();
    ctx.restore();

    // 금속광 타이틀
    ctx.save();
    const metal = ctx.createLinearGradient(px + 12, py + 10, px + w - 12, py + 38);
    metal.addColorStop(0, "#f4d48a");
    metal.addColorStop(0.35, "#fff1ce");
    metal.addColorStop(0.7, "#a9c7ff");
    metal.addColorStop(1, "#f2a869");
    ctx.fillStyle = metal;
    ctx.font = `${Math.max(14, cell * 0.45)}px Segoe UI`;
    ctx.fillText("다음 블록", px + 16, py + 28);
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(px + 16, py + 17, Math.max(90, w * 0.34), Math.max(2, cell * 0.05));
    ctx.restore();

    const shape = next.shape;
    const previewCell = Math.max(12, Math.min(24, Math.floor(cell * 0.7)));
    const blockW = shape[0].length * previewCell;
    const blockH = shape.length * previewCell;
    const sx = px + (w - blockW) / 2;
    const sy = py + (h - blockH) / 2 + 8;

    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        neonRect(sx + x * previewCell + 1, sy + y * previewCell + 1, previewCell - 2, previewCell - 2, next.color, 1);
      }
    }
    ctx.restore();
  }

  function drawRoyalOverlayPanel(theme = "over") {
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    const w = Math.min(canvas.width * 0.78, Math.max(520, canvas.width * 0.52));
    const h = Math.min(canvas.height * 0.5, Math.max(250, canvas.height * 0.34));
    const x = cx - w / 2;
    const y = cy - h / 2;

    ctx.save();
    ctx.fillStyle = theme === "clear" ? "rgba(6, 20, 18, 0.62)" : "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, "rgba(12, 18, 40, 0.88)");
    bg.addColorStop(0.55, "rgba(7, 10, 26, 0.84)");
    bg.addColorStop(1, "rgba(5, 9, 22, 0.9)");
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    const frame = ctx.createLinearGradient(x, y, x + w, y + h);
    frame.addColorStop(0, "rgba(246, 208, 132, 0.84)");
    frame.addColorStop(0.45, "rgba(176, 210, 255, 0.68)");
    frame.addColorStop(1, "rgba(255, 168, 92, 0.8)");
    ctx.strokeStyle = frame;
    ctx.lineWidth = Math.max(2, cell * 0.08);
    ctx.shadowBlur = 28;
    ctx.shadowColor = "rgba(140, 220, 255, 0.28)";
    ctx.strokeRect(x, y, w, h);
    ctx.restore();

    // 왕관형 장식
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.strokeStyle = "rgba(252, 218, 140, 0.9)";
    ctx.lineWidth = 1.8;
    const crownY = y - 14;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, crownY + 9);
    ctx.lineTo(x + w * 0.31, crownY - 10);
    ctx.lineTo(x + w * 0.43, crownY + 9);
    ctx.lineTo(x + w * 0.5, crownY - 14);
    ctx.lineTo(x + w * 0.57, crownY + 9);
    ctx.lineTo(x + w * 0.69, crownY - 10);
    ctx.lineTo(x + w * 0.8, crownY + 9);
    ctx.stroke();
    ctx.restore();

    return { x, y, w, h, cx, cy };
  }

  function drawGameOver() {
    const panel = drawRoyalOverlayPanel("over");
    const { cx, cy, x, w } = panel;
    ctx.save();
    const metal = ctx.createLinearGradient(x + 24, cy - 40, x + w - 24, cy - 6);
    metal.addColorStop(0, "#f3d181");
    metal.addColorStop(0.38, "#fff2cf");
    metal.addColorStop(0.72, "#a9c7ff");
    metal.addColorStop(1, "#f09e63");
    ctx.fillStyle = metal;
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.max(36, cell * 1.42)}px Segoe UI`;
    ctx.fillText("GAME OVER", cx, cy - 20);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(cx - w * 0.18, cy - 41, w * 0.36, Math.max(3, cell * 0.07));
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#e9f4ff";
    ctx.font = `${Math.max(18, cell * 0.62)}px Segoe UI`;
    ctx.fillText("R 키를 눌러 다시 시작", cx, cy + 30);
    ctx.restore();
  }

  function drawGameClear() {
    const panel = drawRoyalOverlayPanel("clear");
    const { cx, cy, x, w } = panel;
    ctx.save();
    const metal = ctx.createLinearGradient(x + 24, cy - 46, x + w - 24, cy - 6);
    metal.addColorStop(0, "#f4d48a");
    metal.addColorStop(0.35, "#fff7df");
    metal.addColorStop(0.7, "#baf7d3");
    metal.addColorStop(1, "#9ce8ff");
    ctx.fillStyle = metal;
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.max(38, cell * 1.5)}px Segoe UI`;
    ctx.fillText("LEVEL 50 CLEAR!", cx, cy - 24);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(cx - w * 0.24, cy - 45, w * 0.48, Math.max(3, cell * 0.07));
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#c5ffe2";
    ctx.font = `${Math.max(20, cell * 0.72)}px Segoe UI`;
    ctx.fillText("축하합니다. 최고 난이도 돌파", cx, cy + 16);
    ctx.font = `${Math.max(16, cell * 0.55)}px Segoe UI`;
    ctx.fillStyle = "#e7f5ff";
    ctx.fillText("R 키를 눌러 새 게임 시작", cx, cy + 48);
    ctx.restore();
  }

  function getVisualFxProfile() {
    const profile = getBgmProfile(level);
    const bossActive = profile.bossStage && !gameOver && !gameCleared;
    const tensionBoost = profile.tensionMode ? 0.34 : 0;
    const bossIntensity = bossActive ? Math.min(1, 0.55 + tensionBoost + ((level - 45) / 10) * 0.2) : 0;
    return { bossActive, bossIntensity };
  }

  function updateBossVisualFx(delta) {
    const fx = getVisualFxProfile();
    if (!fx.bossActive) {
      cameraShakeX = 0;
      cameraShakeY = 0;
      glitchTimer = 0;
      bossPulse = 0;
      return;
    }

    const intensity = fx.bossIntensity;
    const d = delta * 0.001;
    bossPulse += d * (3.6 + intensity * 2.4);
    cameraShakePhase += d * (24 + intensity * 18);

    const amp = 0.28 + intensity * 1.55;
    cameraShakeX = Math.sin(cameraShakePhase * 1.21) * amp + (Math.random() - 0.5) * amp * 0.45;
    cameraShakeY = Math.cos(cameraShakePhase * 1.53) * amp * 0.82 + (Math.random() - 0.5) * amp * 0.38;

    glitchTimer -= delta;
    const chance = 0.02 + intensity * 0.08;
    if (glitchTimer <= 0 && Math.random() < chance) {
      glitchTimer = 30 + Math.random() * (130 - intensity * 70);
    }
  }

  function drawBossVignette(intensity) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const pulse = 0.72 + Math.sin(bossPulse * 2.1) * 0.18;
    const radius = Math.max(canvas.width, canvas.height) * (0.36 + pulse * 0.3);
    const g = ctx.createRadialGradient(cx, cy, radius * 0.22, cx, cy, radius);
    g.addColorStop(0, `rgba(0,0,0,${0.02 + intensity * 0.06})`);
    g.addColorStop(0.58, `rgba(0,0,0,${0.26 + intensity * 0.2})`);
    g.addColorStop(1, `rgba(0,0,0,${0.7 + intensity * 0.2})`);

    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function drawBossGlitch(intensity) {
    if (glitchTimer <= 0) return;

    const stripCount = 2 + ((Math.random() * (5 + intensity * 6)) | 0);
    const maxShift = 3 + intensity * 11;
    for (let i = 0; i < stripCount; i++) {
      const y = (Math.random() * canvas.height) | 0;
      const h = 2 + ((Math.random() * (6 + intensity * 8)) | 0);
      const shift = (Math.random() - 0.5) * maxShift;
      const alpha = 0.08 + Math.random() * (0.1 + intensity * 0.18);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(canvas, 0, y, canvas.width, h, shift, y, canvas.width, h);
      ctx.restore();
    }

    if (Math.random() < 0.16 + intensity * 0.22) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255, 40, 90, ${0.05 + intensity * 0.08})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  function drawBossLineFlash() {
    if (bossFlashTimer <= 0) return;
    const t = Math.max(0, bossFlashTimer / 120);
    const alpha = Math.min(0.85, bossFlashStrength * t);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(255,245,210,${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgba(255,120,160,${alpha * 0.35})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function updateBossShockwaves(delta) {
    if (!bossShockwaves.length) return;
    const d = delta * 0.001;
    bossShockwaves = bossShockwaves.filter((w) => {
      w.life -= delta;
      if (w.life <= 0) return false;
      w.radius += w.speed * d;
      return true;
    });
  }

  function drawBossShockwaves() {
    if (!bossShockwaves.length) return;
    for (const w of bossShockwaves) {
      const alpha = Math.max(0, w.life / w.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = w.width * (0.75 + alpha * 0.5);
      ctx.shadowBlur = 18;
      ctx.shadowColor = w.color;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function triggerVoicePopup(text, color = "#ffffff", duration = 950, withSound = false, b2bCount = 0, isBackToBackCue = false) {
    voicePopupText = text;
    voicePopupColor = color;
    voicePopupTimer = duration;
    const b2bCue = isBackToBackCue || text.includes("BACK TO BACK") || text.includes("UNSTOPPABLE") || text.includes("DOMINATING") || text.includes("RAMPAGE");
    if (b2bCue) {
      const chain = Math.max(1, Math.min(8, b2bCount || backToBackTetris || 1));
      voicePingChainLevel = chain;
      voicePingBoostDuration = 650 + (chain - 1) * 120;
      voicePingBoostTimer = voicePingBoostDuration;
    }
    if (withSound) {
      playVoiceCueSound(getVoiceCueTypeByText(text, b2bCue));
    }
  }

  function updateStackVfx(delta) {
    if (voicePopupTimer > 0) {
      voicePopupTimer = Math.max(0, voicePopupTimer - delta);
    }
    if (voicePingBoostTimer > 0) {
      voicePingBoostTimer = Math.max(0, voicePingBoostTimer - delta);
    }
    borderFlameEnergy = Math.max(0, borderFlameEnergy - delta * 0.0016);
  }

  function drawBorderFlames() {
    if (borderFlameEnergy <= 0) return;
    const e = Math.min(1, borderFlameEnergy);
    const pulse = 0.72 + Math.sin(bossPulse * 3.4 + performance.now() * 0.012) * 0.28;
    const alpha = Math.min(0.78, e * (0.35 + pulse * 0.45));
    const thickness = Math.max(8, cell * (0.22 + e * 0.36));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const topGrad = ctx.createLinearGradient(0, 0, 0, thickness * 4);
    topGrad.addColorStop(0, `rgba(255,120,40,${alpha})`);
    topGrad.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, canvas.width, thickness * 4);

    const bottomGrad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - thickness * 4);
    bottomGrad.addColorStop(0, `rgba(255,70,30,${alpha})`);
    bottomGrad.addColorStop(1, "rgba(255,70,30,0)");
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, canvas.height - thickness * 4, canvas.width, thickness * 4);

    const leftGrad = ctx.createLinearGradient(0, 0, thickness * 4, 0);
    leftGrad.addColorStop(0, `rgba(255,140,60,${alpha * 0.9})`);
    leftGrad.addColorStop(1, "rgba(255,140,60,0)");
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, thickness * 4, canvas.height);

    const rightGrad = ctx.createLinearGradient(canvas.width, 0, canvas.width - thickness * 4, 0);
    rightGrad.addColorStop(0, `rgba(255,90,120,${alpha * 0.95})`);
    rightGrad.addColorStop(1, "rgba(255,90,120,0)");
    ctx.fillStyle = rightGrad;
    ctx.fillRect(canvas.width - thickness * 4, 0, thickness * 4, canvas.height);
    ctx.restore();
  }

  function drawVoicePopup() {
    if (voicePopupTimer <= 0 || !voicePopupText) return;
    const t = Math.max(0, voicePopupTimer / 950);
    const rise = (1 - t) * 26;
    const alpha = Math.min(1, 0.25 + t * 0.95);

    ctx.save();
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.max(30, cell * 1.2)}px Segoe UI`;
    ctx.shadowBlur = 18;
    ctx.shadowColor = voicePopupColor;
    ctx.fillStyle = `rgba(10, 14, 28, ${alpha * 0.45})`;
    ctx.fillRect(canvas.width * 0.5 - 240, canvas.height * 0.2 - 36 - rise, 480, 72);
    ctx.fillStyle = voicePopupColor;
    ctx.globalAlpha = alpha;
    ctx.fillText(voicePopupText, canvas.width * 0.5, canvas.height * 0.2 + 12 - rise);
    ctx.restore();
  }

  function triggerBossLineCinematic(clearedLines, stackLevel, isBackToBack) {
    const profile = getBgmProfile(level);
    if (!profile.bossStage || gameOver || gameCleared) return;
    const isTetris = clearedLines === 4;
    const stackBoost = Math.min(8, stackLevel) * 0.06;
    const slowmoDuration = (isTetris ? 220 : 120) + Math.min(140, stackLevel * 12);
    const flashDuration = (isTetris ? 180 : 120) + Math.min(90, stackLevel * 7);
    const flashBoost = (isTetris ? 0.2 : 0) + stackBoost + (isBackToBack ? 0.12 : 0);
    bossSlowmoTimer = Math.max(bossSlowmoTimer, slowmoDuration);
    bossFlashTimer = flashDuration;
    bossFlashStrength = Math.min(1, 0.62 + clearedLines * 0.08 + flashBoost + (profile.tensionMode ? 0.14 : 0));
    cameraShakePhase += 0.8 + clearedLines * 0.35 + stackLevel * 0.24;

    if (isTetris) {
      const centerX = boardX + boardWidth * 0.5;
      const centerY = boardY + boardHeight * 0.5;
      const hueA = (20 + stackLevel * 22 + (isBackToBack ? 24 : 0)) % 360;
      const hueB = (340 + stackLevel * 14 + (isBackToBack ? 28 : 0)) % 360;
      bossShockwaves.push({
        x: centerX,
        y: centerY,
        radius: Math.max(50, cell * 1.6),
        speed: Math.max(420, cell * (12 + stackLevel * 0.5)),
        width: Math.max(10, cell * (0.52 + stackLevel * 0.035)),
        life: 680 + stackLevel * 35,
        maxLife: 680 + stackLevel * 35,
        color: `hsla(${hueA}, 96%, 68%, 1)`
      });
      bossShockwaves.push({
        x: centerX,
        y: centerY,
        radius: Math.max(30, cell * 1.1),
        speed: Math.max(530, cell * (15.5 + stackLevel * 0.62)),
        width: Math.max(8, cell * (0.42 + stackLevel * 0.03)),
        life: 520 + stackLevel * 30,
        maxLife: 520 + stackLevel * 30,
        color: `hsla(${hueB}, 100%, 64%, 1)`
      });
      playTetrisImpactSound();
    }

    playStackSurgeSound(stackLevel, isTetris, isBackToBack);
  }

  function spawnImpactBurst(gx, gy, color, count, speed) {
    const cx = boardX + gx * cell + cell / 2;
    const cy = boardY + gy * cell + cell / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = (Math.random() * 0.7 + 0.6) * speed;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - Math.random() * 0.4,
        life: 420 + Math.random() * 220,
        maxLife: 620,
        size: Math.max(2, cell * (Math.random() * 0.12 + 0.08)),
        color,
        gravity: 0.021 + Math.random() * 0.02,
        drag: 0.986
      });
    }
  }

  function spawnShatter(gx, gy, color, density, options = {}) {
    const bx = boardX + gx * cell;
    const by = boardY + gy * cell;
    const combo = Math.max(0, options.combo || 0);
    const stack = Math.max(0, options.stack || 0);
    const critical = !!options.critical;
    const power = Math.min(2.4, 1 + combo * 0.13 + stack * 0.08 + (critical ? 0.35 : 0));
    const shards = Math.min(42, Math.max(8, Math.floor(density * power * 0.7)));
    for (let i = 0; i < shards; i++) {
      const ox = Math.random() * cell;
      const oy = Math.random() * cell;
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 2.7 + 1.0) * power;
      const isDebris = Math.random() < 0.38 + Math.min(0.32, combo * 0.03 + stack * 0.02);
      particles.push({
        kind: isDebris ? "debris" : "spark",
        x: bx + ox,
        y: by + oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 1.5,
        life: (650 + Math.random() * 460) * (0.95 + power * 0.25),
        maxLife: (1150 + Math.random() * 260) * (0.9 + power * 0.18),
        size: Math.max(1, cell * (Math.random() * 0.15 + (isDebris ? 0.11 : 0.07))),
        w: Math.max(1, cell * (Math.random() * 0.24 + 0.1)),
        h: Math.max(1, cell * (Math.random() * 0.11 + 0.05)),
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * (0.5 + power * 0.6),
        canBounce: isDebris,
        bounced: false,
        restitution: 0.34 + Math.random() * 0.16,
        color,
        gravity: 0.03 + Math.random() * 0.03 + power * 0.01,
        drag: 0.982 - Math.min(0.015, power * 0.005)
      });
    }
  }

  function spawnThickFlameBurst(gx, gy, color, options = {}) {
    const bx = boardX + gx * cell + cell * 0.5;
    const by = boardY + gy * cell + cell * 0.55;
    const combo = Math.max(0, options.combo || 0);
    const stack = Math.max(0, options.stack || 0);
    const critical = !!options.critical;
    const power = Math.min(2.2, 1 + combo * 0.12 + stack * 0.06 + (critical ? 0.3 : 0));
    const flames = Math.min(9, Math.max(3, Math.floor(3 + power * 2.4)));

    for (let i = 0; i < flames; i++) {
      const sway = (Math.random() - 0.5) * (0.7 + power * 0.6);
      const up = (Math.random() * 1.8 + 1.2) * power;
      particles.push({
        kind: "flame",
        x: bx + (Math.random() - 0.5) * cell * 0.28,
        y: by + (Math.random() - 0.5) * cell * 0.18,
        vx: sway,
        vy: -up,
        life: 210 + Math.random() * 170,
        maxLife: 360,
        w: Math.max(3, cell * (0.1 + Math.random() * 0.1 + power * 0.03)),
        h: Math.max(8, cell * (0.32 + Math.random() * 0.26 + power * 0.06)),
        angle: (Math.random() - 0.5) * 0.6,
        spin: (Math.random() - 0.5) * 0.12,
        noisePhase: Math.random() * Math.PI * 2,
        noiseSpeed: 0.018 + Math.random() * 0.03 + power * 0.008,
        noiseAmp: cell * (0.012 + Math.random() * 0.028 + power * 0.012),
        color: critical ? "#ff9e45" : color,
        gravity: 0.006 + Math.random() * 0.008,
        drag: 0.962
      });
    }
  }

  function spawnBounceSparks(x, y, color, strength = 1) {
    const count = Math.max(3, Math.min(10, Math.floor(4 + strength * 3)));
    const out = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI + Math.PI; // 위쪽 반원으로 튀게
      const speed = 1.1 + Math.random() * 2.4 * strength;
      out.push({
        kind: "ember",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.75,
        life: 220 + Math.random() * 240,
        maxLife: 420,
        size: Math.max(1, cell * (0.03 + Math.random() * 0.05)),
        color: Math.random() < 0.45 ? "#ffd37a" : color,
        gravity: 0.02 + Math.random() * 0.018,
        drag: 0.975
      });
    }
    return out;
  }

  function spawnBounceDust(x, y, strength = 1) {
    const count = Math.max(2, Math.min(7, Math.floor(2 + strength * 2.4)));
    const out = [];
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * (0.6 + strength * 0.9);
      out.push({
        kind: "dust",
        x: x + (Math.random() - 0.5) * cell * 0.2,
        y: y - Math.random() * cell * 0.06,
        vx: spread,
        vy: -(0.15 + Math.random() * 0.35),
        life: 120 + Math.random() * 180,
        maxLife: 300,
        size: Math.max(2, cell * (0.08 + Math.random() * 0.08)),
        baseSize: Math.max(2, cell * (0.08 + Math.random() * 0.08)),
        grow: 1.015 + Math.random() * 0.02,
        color: "rgba(200, 215, 235, 0.9)",
        gravity: 0.008 + Math.random() * 0.01,
        drag: 0.95
      });
    }
    return out;
  }

  function spawnGroundImpactRing(x, y, strength = 1) {
    const radius = Math.max(8, cell * (0.22 + strength * 0.2));
    return {
      kind: "groundRing",
      x,
      y: y + 1,
      vx: 0,
      vy: 0,
      life: 80,
      maxLife: 80,
      radius,
      ringW: Math.max(2, cell * (0.03 + strength * 0.02)),
      expand: 1.26 + strength * 0.12,
      color: "rgba(18, 28, 42, 0.65)",
      gravity: 0,
      drag: 1
    };
  }

  function updateParticles(dt) {
    const decay = dt;
    const spawned = [];
    const groundY = boardY + boardHeight - 2;
    particles = particles.filter((p) => {
      p.life -= decay;
      if (p.life <= 0) return false;
      p.vx *= Math.pow(p.drag, decay * 0.06);
      p.vy *= Math.pow(p.drag, decay * 0.06);
      p.vy += p.gravity * decay * 0.06;
      p.x += p.vx * decay * 0.08;
      p.y += p.vy * decay * 0.08;

      if (p.canBounce && !p.bounced && p.y >= groundY && p.vy > 0) {
        p.y = groundY;
        p.vy = -Math.abs(p.vy) * (p.restitution || 0.38);
        p.vx *= 0.72;
        p.bounced = true;
        if (p.spin) p.spin *= -0.45;
        const impact = Math.min(1.6, Math.abs(p.vy) * 0.35);
        spawned.push(...spawnBounceSparks(p.x, p.y, p.color, impact));
        spawned.push(...spawnBounceDust(p.x, p.y, impact));
        spawned.push(spawnGroundImpactRing(p.x, p.y, impact));
      }

      if (p.spin) {
        p.angle += p.spin * decay * 0.05;
        p.spin *= Math.pow(0.988, decay * 0.06);
      }
      if (p.kind === "dust") {
        p.size *= Math.pow(p.grow || 1.01, decay * 0.06);
      } else if (p.kind === "groundRing") {
        p.radius *= Math.pow(p.expand || 1.2, decay * 0.055);
      } else if (p.kind === "flame") {
        p.h *= Math.pow(0.988, decay * 0.06);
        p.w *= Math.pow(0.992, decay * 0.06);
        p.noisePhase = (p.noisePhase || 0) + (p.noiseSpeed || 0.02) * decay;
        const flutter = Math.sin(p.noisePhase) * (p.noiseAmp || 0.4);
        p.x += flutter * decay * 0.01;
        p.angle += flutter * 0.002;
      }
      return true;
    });
    if (spawned.length) {
      particles.push(...spawned);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 16;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      if (p.kind === "debris") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        const dw = p.w || p.size;
        const dh = p.h || p.size * 0.6;
        ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(-dw / 2, -dh / 2, dw * 0.45, Math.max(1, dh * 0.28));
      } else if (p.kind === "ember") {
        ctx.shadowBlur = 22;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.kind === "dust") {
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(180, 200, 220, 0.35)";
        ctx.globalCompositeOperation = "screen";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(185, 200, 220, 0.24)";
        ctx.fill();
      } else if (p.kind === "groundRing") {
        const r = p.radius || p.size || 8;
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = "multiply";
        ctx.strokeStyle = "rgba(16, 24, 36, 0.45)";
        ctx.lineWidth = p.ringW || 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r * 0.36, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "flame") {
        const fwBase = p.w || p.size || 4;
        const fh = p.h || p.size * 2 || 10;
        const flickerA = Math.sin((p.noisePhase || 0) * 1.7);
        const flickerB = Math.sin((p.noisePhase || 0) * 3.1 + 0.7);
        const fw = fwBase * (1 + flickerA * 0.16 + flickerB * 0.08);
        const flameLean = (flickerA * 0.09 + flickerB * 0.05);
        const heat = Math.max(0, Math.min(1, alpha)); // 1: 고온(밝은 주황), 0: 저온(붉은 잔광)
        const outerR = 255;
        const outerG = Math.floor(56 + heat * 104);
        const outerB = Math.floor(14 + heat * 26);
        const coreR = 255;
        const coreG = Math.floor(120 + heat * 95);
        const coreB = Math.floor(70 + heat * 60);
        const emberR = Math.floor(180 + (1 - heat) * 55);
        const emberG = Math.floor(26 + (1 - heat) * 24);
        const emberB = Math.floor(20 + (1 - heat) * 18);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle || 0) + flameLean);
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 18 + heat * 14;
        ctx.fillStyle = `rgba(${outerR},${outerG},${outerB},${0.55 + heat * 0.35})`;
        ctx.fillRect(-fw / 2, -fh, fw, fh);
        // 중심부는 더 밝게, 끝으로 갈수록 붉은 잔광만 남게 처리
        ctx.globalAlpha = alpha * (0.52 + heat * 0.38);
        ctx.fillStyle = `rgba(${coreR},${coreG},${coreB},0.95)`;
        ctx.fillRect(-fw * 0.32, -fh * 0.78, fw * 0.64, fh * 0.48);
        if (heat < 0.45) {
          ctx.globalAlpha = alpha * (0.35 + (1 - heat) * 0.45);
          ctx.fillStyle = `rgba(${emberR},${emberG},${emberB},0.9)`;
          ctx.fillRect(-fw * 0.5, -fh * 0.18, fw, fh * 0.2);
        }
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }

  function update(delta) {
    sceneTime += delta;
    if (hudLevelFlashTimer > 0) hudLevelFlashTimer = Math.max(0, hudLevelFlashTimer - delta);
    updateBgm();
    updateBossVisualFx(delta);
    updateVoiceFxModulation();
    updateStackVfx(delta);
    if (bossSlowmoTimer > 0) bossSlowmoTimer = Math.max(0, bossSlowmoTimer - delta);
    if (bossFlashTimer > 0) bossFlashTimer = Math.max(0, bossFlashTimer - delta);
    const timeScale = bossSlowmoTimer > 0 ? 0.24 : 1;
    const scaledDelta = delta * timeScale;
    updateBossShockwaves(scaledDelta);

    if (gameCleared) {
      clearFxTimer += scaledDelta;
      if (clearFxTimer >= 220) {
        clearFxTimer = 0;
        const burstCount = 3 + ((Math.random() * 4) | 0);
        for (let i = 0; i < burstCount; i++) {
          const x = (Math.random() * COLS) | 0;
          const y = (Math.random() * (ROWS * 0.45)) | 0;
          const color = NEON_COLORS[(Math.random() * NEON_COLORS.length) | 0];
          spawnShatter(x, y, color, 12);
        }
      }
    } else if (!gameOver) {
      dropCounter += scaledDelta;
      const dropInterval = getDropIntervalByLevel(level);

      if (dropCounter >= dropInterval) {
        if (!tryMove(0, 1)) {
          lockTimer += scaledDelta;
          if (lockTimer >= LOCK_DELAY) lockPiece();
        } else {
          score += 1;
          lockTimer = 0;
        }
        dropCounter = 0;
      }

      if (collide(current.x, current.y + 1, current.shape)) {
        lockTimer += scaledDelta;
        if (lockTimer >= LOCK_DELAY) lockPiece();
      } else {
        lockTimer = 0;
      }
    }

    updateParticles(scaledDelta);
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrandBackdrop();

    ctx.save();
    ctx.translate(cameraShakeX, cameraShakeY);
    drawGrid();
    drawBoard();
    if (!gameOver && !gameCleared) {
      drawGhost();
      drawCurrent();
    }
    drawParticles();
    drawHud();
    ctx.restore();

    if (gameOver) {
      drawGameOver();
    } else if (gameCleared) {
      drawGameClear();
    }

    const fx = getVisualFxProfile();
    if (fx.bossActive) {
      drawBossVignette(fx.bossIntensity);
      drawBossGlitch(fx.bossIntensity);
    }
    drawBorderFlames();
    drawBossShockwaves();
    drawBossLineFlash();
    drawVoicePopup();
    drawCinematicOverlay();
  }

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const delta = Math.min(34, ts - lastTime);
    lastTime = ts;

    update(delta);
    render();
    requestAnimationFrame(loop);
  }

  const chatbotEl = document.getElementById("chatbot");
  const chatInput = document.getElementById("chatbot-input");
  const chatSend = document.getElementById("chatbot-send");
  const chatLog = document.getElementById("chatbot-log");
  const chatClose = document.getElementById("chatbot-close");
  let chatOpen = false;

  const CHAT_KB = [
    { keys: ["조작", "조작법", "키", "방향", "이동", "컨트롤", "control", "key", "move", "어떻게", "키보드", "조종", "움직", "돌리", "회전", "드롭", "내리", "놓", "조작해", "조작은"], answer: "◆ 게임 조작법 ◆\n\n← → : 블록 좌우 이동\n↓ : 소프트 드롭 (1점 추가)\n↑ : 블록 회전\nSpace : 하드 드롭 (즉시 착지)\n\n◆ 기타 키 ◆\n\nR : 재시작 (게임오버/클리어 시)\nM : 효과음 ON/OFF\nB : BGM ON/OFF\nC : 이 챗봇 열기/닫기" },
    { keys: ["콤보", "combo", "칭찬", "great", "연쇄", "연속 깨", "계속 깨"], answer: "◆ 콤보 단계표 ◆\n\n라인을 연속으로 깨면 콤보가 올라갑니다!\n\n1회: GREAT\n2회: VERY GREAT\n3회: 좋은 콤보\n4회: 아주좋은 콤보\n5회: 완전 좋은 콤보\n6회: 대단히 좋음 콤보\n8회+: 압도적인 콤보\n10회+: 경이로운 콤보\n12회+: 전설적인 콤보\n\n클리어 실패 시 콤보가 리셋됩니다." },
    { keys: ["백투백", "b2b", "back to back", "테트리스 연속", "4줄 연속"], answer: "◆ 백투백(B2B) 시스템 ◆\n\n4줄(테트리스)을 연속 클리어하면 B2B가 누적됩니다.\n\nx2: BACK TO BACK!\nx3: BACK TO BACK x3!\nx4: RAMPAGE\nx5: DOMINATING\nx6+: UNSTOPPABLE!\n\n중간에 다른 줄 수가 끼면 B2B 리셋." },
    { keys: ["레벨", "난이도", "단계", "level", "stage", "스테이지", "속도", "빨라"], answer: "◆ 레벨/스테이지 시스템 ◆\n\n5줄 클리어마다 레벨이 1 올라갑니다.\n5레벨마다 스테이지(1~10) 전환.\n\n스테이지가 오를수록:\n• 낙하 속도 증가\n• BGM 템포 증가\n• 레이어 추가\n\n최종 레벨 50 도달 시 게임 클리어!" },
    { keys: ["보스", "boss", "스테이지10", "최종 보스", "마지막"], answer: "◆ 보스 스테이지 ◆\n\n스테이지 10 (레벨 46~50)은 보스 구간!\n\n• 글리치/비네트/카메라 쉐이크 VFX 자동 발동\n• BGM이 보스 전용 테마로 전환\n• 레벨 45+ 긴장 모드: 필터/템포 급상승\n• 4줄 클리어 시 슬로모션 + 링 파동 연출" },
    { keys: ["점수", "score", "스코어", "몇점", "몇 점", "계산"], answer: "◆ 점수 계산법 ◆\n\n소프트 드롭(↓): 1점\n하드 드롭(Space): 칸당 2점\n\n라인 클리어 점수:\n• 1줄: 120 × 현재 레벨\n• 2줄: 300 × 현재 레벨\n• 3줄: 550 × 현재 레벨\n• 4줄(테트리스): 900 × 현재 레벨" },
    { keys: ["사운드", "소리", "음악", "bgm", "효과음", "sfx", "뮤직", "노래", "볼륨", "끄기", "켜기"], answer: "◆ 사운드 시스템 ◆\n\nM 키: 효과음(SFX) ON/OFF\nB 키: BGM ON/OFF\n\n• BGM은 스테이지별로 템포/레이어가 변합니다\n• 보스 스테이지는 전용 BGM\n• VOICE(BACK TO BACK 등)는 포먼트 신스 + 리버브/딜레이 적용" },
    { keys: ["불꽃", "파편", "이펙트", "효과", "터짐", "파괴", "깨짐", "폭발", "부서"], answer: "◆ 파괴 이펙트 ◆\n\n라인 클리어 시 블록이 조각(debris)과 스파크로 박살!\n\n• 콤보/스택이 높을수록 파편 수/속도/불꽃 강도 증가\n• 파편은 바닥에서 1회 바운스\n• 바운스 시 잔불 스파크 + 먼지 연무 + 접지 충격 링\n• 굵은 불꽃은 색온도 변화(주황→붉은 잔광)" },
    { keys: ["클리어", "clear", "승리", "엔딩", "끝", "완료"], answer: "◆ 게임 클리어 ◆\n\n레벨 50에 도달하면 LEVEL 50 CLEAR!\n\n• 축하 파티클 폭발 연출\n• 전용 클리어 사운드 재생\n• R 키로 새 게임을 시작할 수 있습니다" },
    { keys: ["챗봇", "도움", "help", "도움말", "?", "뭐", "알려", "설명", "안내", "c키", "c 키", "단축키", "shortcut"], answer: "◆ 챗봇 사용법 ◆\n\n이 챗봇은 네온 테트리스 게임 도우미입니다.\nC 키로 열고 닫을 수 있습니다.\n\n질문 예시:\n• \"조작법\" - 키보드 조작 안내\n• \"콤보\" - 콤보 단계표\n• \"점수\" - 점수 계산법\n• \"보스\" - 보스 스테이지 설명\n• \"사운드\" - 오디오 설정\n• \"불꽃\" - 이펙트 설명\n• \"레벨\" - 난이도 시스템\n• \"클리어\" - 게임 클리어 조건" },
    { keys: ["홀드", "hold", "저장"], answer: "현재 버전에서는 홀드(hold) 기능은 미구현입니다.\n추후 업데이트에서 추가될 수 있습니다." },
    { keys: ["시작", "start", "게임", "어떤 게임", "뭔 게임", "테트리스"], answer: "◆ 네온 테트리스 ◆\n\n형광(네온) 블록 테트리스 게임입니다.\n\n• 레벨 1~50, 스테이지 10단계\n• 블록 파괴 시 불꽃/파편 연출\n• 콤보/B2B 시스템\n• 보스 스테이지(VFX/전용 BGM)\n• C 키로 이 챗봇을 열어 도움을 받으세요!" },
    { keys: ["블록", "모양", "종류", "피스", "piece"], answer: "◆ 블록 종류 (7종) ◆\n\nI : ████ (직선)\nO : ██ (정사각)\nT : _█_ / ███\nS : _██ / ██_\nZ : ██_ / _██\nJ : █__ / ███\nL : __█ / ███\n\n↑ 키로 회전할 수 있습니다." },
    { keys: ["게임오버", "game over", "죽", "끝나", "지면", "졌"], answer: "◆ 게임오버 조건 ◆\n\n새 블록이 생성될 때 이미 블록이 쌓여 있으면 게임오버!\n\nR 키를 누르면 새 게임을 시작할 수 있습니다." }
  ];

  function chatbotAnswer(input) {
    // 입력 문장을 느슨하게 정규화해서 키워드 매칭 정확도를 높입니다.
    const raw = (input || "").trim();
    if (!raw) return "질문을 입력해주세요!";

    // 기본: 소문자 + 양쪽 공백 제거
    const q = raw.toLowerCase();
    // 공백/문장부호 제거 버전 (예: "조작 법?" → "조작법")
    const qCompact = q.replace(/[\s?!.~,;:()]/g, "");

    for (const entry of CHAT_KB) {
      const hit = entry.keys.some((k) => {
        const keyLower = String(k).toLowerCase();
        const keyCompact = keyLower.replace(/\s+/g, "");
        return q.includes(keyLower) || qCompact.includes(keyCompact);
      });
      if (hit) return entry.answer;
    }

    return (
      "죄송합니다. 질문을 정확히 이해하지 못했어요.\n\n" +
      "아래와 같은 키워드로 다시 물어봐 주세요:\n" +
      "• 조작법 / 조작\n" +
      "• 콤보 / 연속으로 깨기\n" +
      "• 백투백 / 4줄 연속\n" +
      "• 점수 / 스코어\n" +
      "• 레벨 / 난이도 / 스테이지\n" +
      "• 보스 / 최종 구간\n" +
      "• 사운드 / 소리 / 음악\n" +
      "• 불꽃 / 이펙트 / 파편\n" +
      "• 클리어 / 엔딩\n" +
      "• 블록 / 모양\n" +
      "• 게임오버\n" +
      "• 도움 / 챗봇 / C키"
    );
  }

  function addChatMsg(text, sender = "bot") {
    const div = document.createElement("div");
    div.className = `chat-msg ${sender}`;
    div.innerHTML = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function toggleChatbot() {
    chatOpen = !chatOpen;
    chatbotEl.classList.toggle("hidden", !chatOpen);
    if (chatOpen) {
      if (chatLog.children.length === 0) {
        addChatMsg("안녕하세요! 네온 테트리스 도우미입니다.\n\n궁금한 것을 물어보세요!\n예: 조작법, 콤보, 보스, 점수, 블록 종류 등", "bot");
      }
      setTimeout(() => chatInput.focus(), 80);
    }
  }

  function submitChat() {
    const val = chatInput.value.trim();
    if (!val) return;
    addChatMsg(val, "user");
    chatInput.value = "";
    chatInput.focus();
    setTimeout(() => {
      addChatMsg(chatbotAnswer(val), "bot");
    }, 200);
  }

  chatSend.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    submitChat();
  });

  chatInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" || e.code === "Enter") {
      e.preventDefault();
      submitChat();
    }
  });

  chatInput.addEventListener("keyup", (e) => e.stopPropagation());
  chatInput.addEventListener("keypress", (e) => e.stopPropagation());

  chatClose.addEventListener("click", () => {
    chatOpen = false;
    chatbotEl.classList.add("hidden");
  });

  window.addEventListener("keydown", (e) => {
    if (chatOpen) {
      if (e.code === "KeyC" && document.activeElement !== chatInput) {
        toggleChatbot();
      }
      return;
    }
    initAudio();
    if (e.code === "KeyC") {
      toggleChatbot();
      return;
    }
    if (e.code === "KeyM") {
      toggleSfx();
      return;
    }
    if (e.code === "KeyB") {
      toggleBgm();
      return;
    }
    if (e.code === "KeyR" && (gameOver || gameCleared)) {
      resetGame();
      return;
    }

    if (gameOver || gameCleared) return;

    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === "ArrowLeft") {
      tryMove(-1, 0);
    } else if (e.code === "ArrowRight") {
      tryMove(1, 0);
    } else if (e.code === "ArrowDown") {
      if (tryMove(0, 1)) score += 1;
    } else if (e.code === "ArrowUp") {
      tryRotate();
    } else if (e.code === "Space") {
      hardDrop();
    }
  });

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(loop);
})();
