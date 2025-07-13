// Инициализация Pusher с вашими ключами
const pusher = new Pusher('7a7fdb60bf55d8ff0dbb', {
  cluster: 'eu',
  forceTLS: true,
  authEndpoint: '/api/pusher-auth'
});

let currentChannel = 'default';
const mySenderId = `user_${Math.random().toString(36).substr(2, 9)}`;

// Подключение к каналу
function connectToChannel(channel) {
  const pusherChannel = pusher.subscribe(`private-morse-${channel}`);
  
  pusherChannel.bind('signal', (data) => {
    if (data.senderId !== mySenderId) {
      console.log('Received signal:', data);
      document.getElementById('console').innerHTML += 
        `<div>Received: ${data.symbol} (${data.duration}ms)</div>`;
    }
  });
}

// Отправка сигнала
async function sendSignal(symbol, duration) {
  await fetch('/api/send-signal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: currentChannel,
      symbol,
      duration,
      senderId: mySenderId
    })
  });
}

// UI обработчики
document.getElementById('signal-btn').addEventListener('mousedown', () => {
  sendSignal('start', Date.now());
});

document.getElementById('signal-btn').addEventListener('mouseup', () => {
  const duration = Date.now() - startTime;
  const symbol = duration > 200 ? '-' : '.';
  sendSignal(symbol, duration);
});

// Инициализация
connectToChannel(currentChannel);