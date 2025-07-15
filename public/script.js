// Инициализация Pusher
const pusher = new Pusher('7a7fdb60bf55d8ff0dbb', {
  cluster: 'eu',
  forceTLS: true,
  authEndpoint: '/api/pusher-auth'
});

// Morse decoder configuration
const morseCode = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
  '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
  '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
  '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
  '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
  '--..': 'Z', '.----': '1', '..---': '2', '...--': '3',
  '....-': '4', '.....': '5', '-....': '6', '--...': '7',
  '---..': '8', '----.': '9', '-----': '0', 
  '--..--': ',', '.-.-.-': '.', '..--..': '?', '-..-.': '/',
  '-....-': '-', '-.--.': '(', '-.--.-': ')', '.--.-.': '@',
  '---...': ':', '-.-.-.': ';', '-...-': '=', '.-.-.': '+',
  '..--.-': '_', '.-..-.': '"', '...-..-': '$', '.----.': "'",
  '-.-.--': '!'
};

// DOM elements
const canvas = document.getElementById("waterfall");
const ctx = canvas.getContext("2d");
const btn = document.getElementById("btn");
const consoleElement = document.getElementById("console");
const channelInput = document.getElementById("channelInput");
const signalIndicator = document.getElementById("signalIndicator");
const showCharsBtn = document.getElementById("showChars");
const showSymbolsBtn = document.getElementById("showSymbols");
const clearConsoleBtn = document.getElementById("clearConsole");
const consoleHeader = document.getElementById("consoleHeader");
const activeChannels = document.getElementById("activeChannels");
const changeChannelBtn = document.getElementById("changeChannel");

// App state
let currentChannel = 444;
let frequency = 600;  
let displayMode = 'chars';
let isTransmitting = false;
let lastSymbolTime = 0;
let currentSymbol = '';
let currentWord = '';
let decoderTimeout = null;
let wordTimeout = null;
let consoleVisible = true;
let activeUsers = {444: 1};
let pusherChannel = null;
const mySenderId = `user_${Math.random().toString(36).substr(2, 9)}`;
const centerX = canvas.width / 2;

// Audio context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let oscillator = null;
let noiseNode = null;

// Initialize Pusher connection
function initPusher() {
  if (pusherChannel) {
    pusher.unsubscribe(`private-morse-${currentChannel}`);
  }
  
  pusherChannel = pusher.subscribe(`private-morse-${currentChannel}`);
  
  pusherChannel.bind('signal', (data) => {
    if (data.senderId !== mySenderId) {
      handleRemoteSignal(data.signalType, data.frequency, data.channel);
    }
  });
  
  pusherChannel.bind('pusher:subscription_succeeded', () => {
    logToConsole(`Connected to channel ${currentChannel}`, 'info');
    updateUserCount(currentChannel, pusherChannel.members.count);
  });
  
  pusherChannel.bind('pusher:member_added', () => {
    updateUserCount(currentChannel, pusherChannel.members.count);
  });
  
  pusherChannel.bind('pusher:member_removed', () => {
    updateUserCount(currentChannel, pusherChannel.members.count);
  });
}

function handleRemoteSignal(signalType, frequency, channel) {
  signalIndicator.classList.add('active');
  drawSignalOnWaterfall(signalType === '-' ? 300 : 100);
  playTone(signalType === '-' ? 300 : 100, frequency);
  
  setTimeout(() => {
    signalIndicator.classList.remove('active');
    processRemoteSignal(signalType);
  }, signalType === '-' ? 300 : 100);
}

function processRemoteSignal(signalType) {
  const now = Date.now();
  const signalGap = now - lastSymbolTime;
  
  if (signalType === '.') {
    currentSymbol += '.';
    if (displayMode === 'symbols') {
      logToConsole('.', 'symbol');
    }
  } else if (signalType === '-') {
    currentSymbol += '-';
    if (displayMode === 'symbols') {
      logToConsole('-', 'symbol');
    }
  }
  
  if (signalGap > 700 && currentWord) {
    currentWord += ' ';
    if (displayMode === 'chars') {
      logToConsole(' ', 'word');
    }
  }
  
  resetDecoderTimeout();
  resetWordTimeout();
  lastSymbolTime = now;
}

// Initialize
function init() {
  drawFullNoiseBackground();
  startNoise();
  setupEventListeners();
  initPusher();
  updateActiveChannels();
  
  setInterval(drawWaterfallLine, 30);
}

function setupEventListeners() {
  // Transmission controls
  btn.addEventListener('mousedown', startTransmit);
  btn.addEventListener('mouseup', stopTransmit);
  btn.addEventListener('touchstart', e => {
    e.preventDefault();
    startTransmit();
  });
  btn.addEventListener('touchend', e => {
    e.preventDefault();
    stopTransmit();
  });

  document.addEventListener("keydown", e => {
    if (e.code === "Space") {
      e.preventDefault();
      startTransmit();
    }
  });

  document.addEventListener("keyup", e => {
    if (e.code === "Space") {
      e.preventDefault();
      stopTransmit();
    }
  });

  // Display mode
  showCharsBtn.addEventListener('click', () => setDisplayMode('chars'));
  showSymbolsBtn.addEventListener('click', () => setDisplayMode('symbols'));
  clearConsoleBtn.addEventListener('click', clearConsole);

  // Channel control
  changeChannelBtn.addEventListener('click', changeChannel);

  // Console toggle
  consoleHeader.addEventListener('click', toggleConsole);
}

// Waterfall display
function drawFullNoiseBackground() {
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const b = 10 + Math.random() * 40;
      ctx.fillStyle = `rgb(0, 0, ${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawWaterfallLine() {
  const imageData = ctx.getImageData(0, 1, canvas.width, canvas.height - 1);
  ctx.putImageData(imageData, 0, 0);
  ctx.clearRect(0, canvas.height - 1, canvas.width, 1);
  
  for (let x = 0; x < canvas.width; x++) {
    let r = 0, g = 0, b = 0;

    if (isTransmitting && Math.abs(x - centerX) < 1 + Math.random()) {
      const intensity = 60 + Math.random() * 105;
      r = intensity;
      b = intensity;
    } else {
      b = 10 + Math.random() * 40;
    }

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(x, canvas.height - 1, 1, 1);
  }
}

// Morse decoder functions
function startTransmit() {
  if (isTransmitting) return;
  isTransmitting = true;
  startTone();
  btn.classList.add('transmitting');
  lastSymbolTime = Date.now();
}

async function stopTransmit() {
  if (!isTransmitting) return;
  isTransmitting = false;
  stopTone();
  btn.classList.remove('transmitting');
  
  const duration = Date.now() - lastSymbolTime;
  const signalType = duration >= 200 ? '-' : '.';
  
  // Отправка сигнала через Pusher
  try {
    await fetch('/api/send-signal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: currentChannel,
        signalType,
        frequency,
        senderId: mySenderId
      })
    });
  } catch (error) {
    console.error('Error sending signal:', error);
  }
  
  processSignal(duration);
}

function processSignal(duration) {
  const now = Date.now();
  const signalGap = now - lastSymbolTime;
  
  if (isTransmitting) {
    const isDash = duration >= 200;
    currentSymbol += isDash ? '-' : '.';
    if (displayMode === 'symbols') {
      logToConsole(isDash ? '-' : '.', 'symbol');
    }
  } 
  else if (signalGap > 700 && currentWord) {
    currentWord += ' ';
    if (displayMode === 'chars') {
      logToConsole(' ', 'word');
    }
  } 
  else if (signalGap > 200 && currentSymbol) {
    if (displayMode === 'chars') {
      const char = morseCode[currentSymbol] || '?';
      logToConsole(char, 'char');
      currentWord += char;
    }
    currentSymbol = '';
  }
  
  lastSymbolTime = now;
}

function resetDecoderTimeout() {
  if (decoderTimeout) clearTimeout(decoderTimeout);
  
  decoderTimeout = setTimeout(() => {
    decodeSymbol();
    if (displayMode === 'chars' && currentWord) {
      logToConsole(' ', 'letter-space');
    }
  }, 400);
}

function resetWordTimeout() {
  if (wordTimeout) clearTimeout(wordTimeout);
  
  wordTimeout = setTimeout(() => {
    if (currentWord) {
      logToConsole(' ', 'word');
      currentWord = '';
    }
  }, 700);
}

function decodeSymbol() {
  if (!currentSymbol) return;
  
  const char = morseCode[currentSymbol] || `[${currentSymbol}]`;
  
  if (displayMode === 'chars') {
    logToConsole(char, 'char');
  }
  
  currentWord += char;
  currentSymbol = '';
}

// Console functions
function logToConsole(message, type = 'info') {
  const span = document.createElement('span');
  
  switch(type) {
    case 'symbol':
      span.className = 'symbol-display';
      break;
    case 'char':
      span.className = 'char-display';
      break;
    case 'word':
      span.className = 'word-space';
      break;
    case 'letter-space':
      span.className = 'letter-space';
      break;
    default:
      span.style.color = '#03a9f4';
  }
  
  span.textContent = message;
  consoleElement.appendChild(span);
  consoleElement.scrollTop = consoleElement.scrollHeight;
}

function clearConsole() {
  consoleElement.innerHTML = '';
  currentSymbol = '';
  currentWord = '';
}

function toggleConsole() {
  consoleVisible = !consoleVisible;
  consoleElement.style.display = consoleVisible ? 'block' : 'none';
  consoleHeader.querySelector('span:last-child').textContent = consoleVisible ? '▼' : '▶';
}

// Channel functions
function changeChannel() {
  const newChannel = parseInt(channelInput.value);
  if (newChannel >= 1 && newChannel <= 999) {
    currentChannel = newChannel;
    initPusher();
    logToConsole(`Switched to channel ${currentChannel}`, 'info');
  } else {
    logToConsole('Invalid channel (1-999)', 'error');
  }
}

function updateUserCount(channel, count) {
  activeUsers[channel] = count;
  updateActiveChannels();
}

function updateActiveChannels() {
  activeChannels.innerHTML = '';
  
  Object.entries(activeUsers).sort((a, b) => a[0] - b[0]).forEach(([channel, users]) => {
    const div = document.createElement('div');
    div.className = `channel-item ${channel == currentChannel ? 'active' : ''}`;
    div.textContent = `${channel} (${users} user${users !== 1 ? 's' : ''})`;
    div.addEventListener('click', () => {
      channelInput.value = channel;
      changeChannel();
    });
    activeChannels.appendChild(div);
  });
}

// Audio functions
function playTone(duration, frequency) {
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  gain.gain.value = 0.3;
  
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start();
  
  setTimeout(() => {
    oscillator.stop();
  }, duration);
}

function startTone() {
  if (oscillator) return;
  stopNoise();
  oscillator = audioCtx.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

  const gain = audioCtx.createGain();
  gain.gain.value = 0.3;

  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start();
}

function stopTone() {
  if (oscillator) {
    oscillator.stop();
    oscillator.disconnect();
    oscillator = null;
  }
  startNoise();
}

function startNoise() {
  if (noiseNode) return;
  const bufferSize = 1024;
  noiseNode = audioCtx.createScriptProcessor(bufferSize, 1, 1);
  const volume = 0.01;
  noiseNode.onaudioprocess = e => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      out[i] = (Math.random() * 2 - 1) * volume;
    }
  };
  noiseNode.connect(audioCtx.destination);
}

function stopNoise() {
  if (noiseNode) {
    noiseNode.disconnect();
    noiseNode = null;
  }
}

// Display mode
function setDisplayMode(mode) {
  displayMode = mode;
  showCharsBtn.classList.toggle('active', mode === 'chars');
  showSymbolsBtn.classList.toggle('active', mode === 'symbols');
  logToConsole(`Display mode: ${mode}`, 'info');
}

function drawSignalOnWaterfall(duration) {
  const startTime = Date.now();
  const interval = setInterval(() => {
    if (Date.now() - startTime > duration) {
      clearInterval(interval);
      return;
    }
    
    const imageData = ctx.getImageData(0, 1, canvas.width, canvas.height - 1);
    ctx.putImageData(imageData, 0, 0);
    ctx.clearRect(0, canvas.height - 1, canvas.width, 1);
    
    for (let x = 0; x < canvas.width; x++) {
      let r = 0, g = 0, b = 0;
      
      if (Math.abs(x - centerX) < 1 + Math.random()) {
        const intensity = 150 + Math.random() * 105;
        r = intensity;
        b = intensity;
      } else {
        b = 10 + Math.random() * 40;
      }
      
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x, canvas.height - 1, 1, 1);
    }
  }, 30);
}

// Initialize everything
init();