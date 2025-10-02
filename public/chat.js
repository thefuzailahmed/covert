// public/chat.js
(function () {
  const params = new URLSearchParams(location.search);
  const roomKey = (params.get('room') || '').trim().toUpperCase();
  const username = (params.get('name') || '').trim() || 'Anon';

  const output = document.getElementById('terminalOutput');
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const roomTitle = document.getElementById('roomTitle');
  const roomInfo = document.getElementById('roomInfo');
  const usersList = document.getElementById('usersList');

  if (!roomKey) {
    alert('Room key missing. Go back and join/create a room.');
    location.href = '/';
  }

  const socket = io();

  function fmtTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function appendSystem(text) {
    const el = document.createElement('div');
    el.className = 'system';
    el.textContent = `[${fmtTime(Date.now())}] ${text}`;
    output.appendChild(el);
    output.scrollTop = output.scrollHeight;
  }

  function appendMessage(msg) {
    const el = document.createElement('div');
    el.className = 'msg';
    el.innerHTML = `
      <div class="meta">[${fmtTime(msg.ts)}] @${escapeHtml(msg.username)}:</div>
      <div class="body">${escapeHtml(msg.text)}</div>
    `;
    output.appendChild(el);
    output.scrollTop = output.scrollHeight;
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // Join room
  socket.emit('join-room', { roomKey, username }, (res) => {
    if (!res || !res.ok) {
      alert('Could not join room: ' + (res && res.err ? res.err : 'unknown'));
      location.href = '/';
      return;
    }
  });

  // Init from server (room + history)
  socket.on('init', (data) => {
    roomTitle.textContent = data.roomName || 'Covert';
    roomInfo.textContent = `${data.roomKey} • history: ${data.messages.length} messages`;
    usersList.textContent = `Users: (connected live only, not stored)`;

    appendSystem(`Joined room "${data.roomName}" (${data.roomKey}) as ${username}`);

    // render history
    data.messages.forEach(m => appendMessage(m));
  });

  socket.on('new-message', (msg) => {
    appendMessage(msg);
  });

  socket.on('user-joined', ({ username: u }) => {
    appendSystem(`${u} joined`);
  });

  // send
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    if (text === '/help') {
      appendSystem('Commands: /help, /clear (clear screen)');
      input.value = '';
      return;
    }
    if (text === '/clear') {
      output.innerHTML = '';
      input.value = '';
      return;
    }

    socket.emit('send-message', { roomKey, username, text });
    input.value = '';
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });
  sendBtn.addEventListener('click', sendMessage);

  input.focus();
})();
