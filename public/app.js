// public/app.js
(function () {
  const createForm = document.getElementById('createForm');
  const joinForm = document.getElementById('joinForm');
  const roomsList = document.getElementById('roomsList');
  const clearRoomsBtn = document.getElementById('clearRooms');

  const popup = document.getElementById('roomPopup');
  const popupRoomName = document.getElementById('popupRoomName');
  const popupRoomKey = document.getElementById('popupRoomKey');
  const copyKeyBtn = document.getElementById('copyKeyBtn');
  const proceedBtn = document.getElementById('proceedBtn');

  function loadRooms() {
    try { return JSON.parse(localStorage.getItem('covert_rooms') || '[]'); }
    catch (e) { return []; }
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
        const name = storedName || prompt('Enter display name for this room');
        if (!name) return;
        if (!storedName) updateRoomName(rk, name);
        window.location.href = `/chat.html?room=${rk}&name=${encodeURIComponent(name)}`;
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

  async function safeFetchJSON(url, options) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      console.log(`Fetch ${url} response:`, text);

      try { 
        return JSON.parse(text); 
      } catch (err) {
        throw new Error('Server returned non-JSON response. Check console for details.');
      }
    } catch (err) {
      throw err;
    }
  }

  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const roomName = document.getElementById('createRoomName').value.trim();
    const username = document.getElementById('createUsername').value.trim() || 'Anon';
    if (!roomName) return alert('Enter a room name');

    try {
      const data = await safeFetchJSON('/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName })
      });

      if (data.roomKey) {
        addRoomObj(data.roomKey, roomName, username);

        popupRoomName.textContent = roomName;
        popupRoomKey.textContent = data.roomKey;
        popup.style.display = 'block';

        copyKeyBtn.onclick = () => {
          navigator.clipboard?.writeText(data.roomKey)
            .then(() => { 
              copyKeyBtn.textContent = 'Copied!'; 
              setTimeout(() => copyKeyBtn.textContent='Copy Key', 1500); 
            })
            .catch(() => alert('Copy failed'));
        };
        proceedBtn.onclick = () => { 
          window.location.href = `/chat.html?room=${data.roomKey}&name=${encodeURIComponent(username)}`;
        };
      } else {
        alert('Failed to create room');
      }
    } catch (err) {
      alert('Network / Server error: ' + err.message);
    }
  });

  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const roomKey = (document.getElementById('joinRoomKey').value || '').trim().toUpperCase();
    const username = document.getElementById('joinUsername').value.trim() || 'Anon';
    if (!roomKey) return alert('Enter room key');

    try {
      const js = await safeFetchJSON(`/room/${roomKey}`);
      if (!js.exists) return alert('Room not found (check the key)');
      addRoomObj(roomKey, js.name, username);
      window.location.href = `/chat.html?room=${roomKey}&name=${encodeURIComponent(username)}`;
    } catch (err) {
      alert('Network / Server error: ' + err.message);
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

  renderRooms();
})();
