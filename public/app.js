// public/app.js
(function () {
  const BACKEND_URL = 'https://covert-8fy8.onrender.com'; // <-- deployed backend URL

  const createForm = document.getElementById('createForm');
  const joinForm = document.getElementById('joinForm');
  const roomsList = document.getElementById('roomsList');
  const clearRoomsBtn = document.getElementById('clearRooms');

  // Popup elements
  const popup = document.getElementById('roomPopup');
  const popupRoomName = document.getElementById('popupRoomName');
  const popupRoomKey = document.getElementById('popupRoomKey');
  const copyKeyBtn = document.getElementById('copyKeyBtn');
  const proceedBtn = document.getElementById('proceedBtn');

  function loadRooms() {
    try {
      return JSON.parse(localStorage.getItem('covert_rooms') || '[]');
    } catch (e) {
      return [];
    }
  }
  function saveRooms(arr) { localStorage.setItem('covert_rooms', JSON.stringify(arr)); }
  function renderRooms() {
    const arr = loadRooms();
    if (!arr.length) {
      roomsList.innerHTML = '<li class="muted">No saved rooms yet</li>';
      return;
    }
    roomsList.innerHTML = arr.map(r => `
      <li>
        <button class="room-btn" data-room="${r.roomKey}" data-name="${encodeURIComponent(r.username||'')}">
          ${escapeHtml(r.roomName)} (${r.roomKey})
        </button>
      </li>
    `).join('');
    document.querySelectorAll('.room-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rk = btn.dataset.room;
        const storedName = decodeURIComponent(btn.dataset.name);
        if (storedName) {
          window.location.href = `/chat.html?room=${rk}&name=${encodeURIComponent(storedName)}`;
        } else {
          const n = prompt('Enter display name for this room');
          if (!n) return;
          updateRoomName(rk, n);
          window.location.href = `/chat.html?room=${rk}&name=${encodeURIComponent(n)}`;
        }
      });
    });
  }

  function addRoomObj(roomKey, roomName, username) {
    const arr = loadRooms();
    const filtered = arr.filter(r => r.roomKey !== roomKey);
    filtered.unshift({ roomKey, roomName, username });
    saveRooms(filtered.slice(0, 25));
    renderRooms();
  }

  function updateRoomName(roomKey, name) {
    const arr = loadRooms();
    const r = arr.find(x => x.roomKey === roomKey);
    if (r) r.username = name;
    saveRooms(arr);
    renderRooms();
  }

  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const roomName = document.getElementById('createRoomName').value.trim();
    const username = document.getElementById('createUsername').value.trim() || 'Anon';
    if (!roomName) return alert('Enter a room name');
    try {
      const res = await fetch(`${BACKEND_URL}/create-room`, { // updated URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName })
      });
      const data = await res.json();
      if (data.roomKey) {
        addRoomObj(data.roomKey, roomName, username);

        // Show popup
        popupRoomName.textContent = roomName;
        popupRoomKey.textContent = data.roomKey;
        popup.style.display = 'block';

        // Copy key button
        copyKeyBtn.onclick = () => {
          const key = data.roomKey;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(key).then(() => {
              copyKeyBtn.textContent = 'Copied!';
              setTimeout(() => copyKeyBtn.textContent = 'Copy Key', 1500);
            }).catch(() => fallbackCopy(key));
          } else {
            fallbackCopy(key);
          }
        };

        // Proceed button
        proceedBtn.onclick = () => {
          redirectToChat();
        };

        function fallbackCopy(text) {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          try { document.execCommand('copy'); } 
          catch (err) { alert('Copy failed, manually copy: ' + text); }
          document.body.removeChild(textarea);
        }

        function redirectToChat() {
          window.location.href = `/chat.html?room=${data.roomKey}&name=${encodeURIComponent(username)}`;
        }

      } else {
        alert('Failed to create room');
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  });

  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const roomKey = (document.getElementById('joinRoomKey').value || '').trim().toUpperCase();
    const username = document.getElementById('joinUsername').value.trim() || 'Anon';
    if (!roomKey) return alert('Enter room key');
    try {
      const res = await fetch(`${BACKEND_URL}/room/${roomKey}`); // updated URL
      const js = await res.json();
      if (!js.exists) return alert('Room not found (check the key)');
      addRoomObj(roomKey, js.name, username);
      window.location.href = `/chat.html?room=${roomKey}&name=${encodeURIComponent(username)}`;
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  });

  clearRoomsBtn.addEventListener('click', () => {
    if (confirm('Clear saved rooms from this browser?')) {
      localStorage.removeItem('covert_rooms');
      renderRooms();
    }
  });

  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }

  // initial render
  renderRooms();
})();
