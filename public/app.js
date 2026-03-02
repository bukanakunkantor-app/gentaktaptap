const socket = io();

// DOM Elements
const screens = {
    login: document.getElementById('login-screen'),
    gm: document.getElementById('gm-screen'),
    player: document.getElementById('player-screen')
};

// Login Elements
const playerNameInput = document.getElementById('player-name');
const btnJoinPlayer = document.getElementById('btn-join-player');
const btnJoinGM = document.getElementById('btn-join-gm');

// GM Elements
const gmGameStatus = document.getElementById('gm-game-status');
const btnStart = document.getElementById('btn-start');
const btnReset = document.getElementById('btn-reset');
const btnCloseRoom = document.getElementById('btn-close-room');
const gmPlayersList = document.getElementById('gm-players-list');
const gmWinnerAnnouncement = document.getElementById('gm-winner-announcement');
const gmWinnerText = gmWinnerAnnouncement.querySelector('span');
const gmRoomNameInput = document.getElementById('gm-room-name');

// Player Elements
const displayName = document.getElementById('display-name');
const playerGameStatus = document.getElementById('player-game-status');
const myProgress = document.getElementById('my-progress');
const myScoreText = document.getElementById('my-score');
const tapButton = document.getElementById('tap-button');
const playerLeaderboard = document.getElementById('player-leaderboard');

// Overlays
const overlayWaiting = document.getElementById('overlay-waiting');
const overlayCountdown = document.getElementById('overlay-countdown');
const overlayFinished = document.getElementById('overlay-finished');
const countdownNumber = document.getElementById('countdown-number');
const winnerNameText = document.getElementById('winner-name-text');
const resultRoomName = document.getElementById('result-room-name');
const resultTitle = document.getElementById('result-title');
const resultSubtitle = document.getElementById('result-subtitle');
const bgmAudio = document.getElementById('bgm-audio');
const popAudio = document.getElementById('pop-audio');
try {
    bgmAudio.volume = 0.5;
    popAudio.volume = 0.8;
} catch (e) { }

// State
let myRole = null;
let myName = '';
let isCountdownActive = false;
const MAX_SCORE = 120;

// Utility functions
function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function updateProgress(score) {
    const percentage = Math.min((score / MAX_SCORE) * 100, 100);
    myProgress.style.width = `${percentage}%`;
    myScoreText.innerText = `${score} / ${MAX_SCORE}`;
}

function triggerConfetti() {
    var duration = 3000;
    var end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#8b5cf6', '#ec4899', '#fbbf24']
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#8b5cf6', '#ec4899', '#fbbf24']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

function handleTap(e) {
    if (isCountdownActive || !tapButton) return;

    // Visual ripple effect
    const circle = tapButton.querySelector('.tap-circle');
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');

    // Position ripple based on click/touch or center if keyboard
    let x, y;
    if (e && (e.clientX || e.touches)) {
        const rect = circle.getBoundingClientRect();
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        x = clientX - rect.left;
        y = clientY - rect.top;
    } else {
        x = circle.offsetWidth / 2;
        y = circle.offsetHeight / 2;
    }

    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    circle.appendChild(ripple);

    setTimeout(() => {
        ripple.remove();
    }, 600);

    // Play pop sound
    try {
        const popClone = popAudio.cloneNode();
        popClone.volume = popAudio.volume;
        popClone.play().catch(e => console.log('Audio overlap restricted:', e));
    } catch (e) { }

    // Send the tap to the server
    socket.emit('tap');
}

// Event Listeners for Login
btnJoinPlayer.addEventListener('click', () => {
    myName = playerNameInput.value.trim() || `Player ${Math.floor(Math.random() * 1000)}`;
    myRole = 'player';

    displayName.innerText = myName;
    uiStateToWaiting();
    switchScreen('player');

    socket.emit('join', { role: 'player', name: myName });
});

btnJoinGM.addEventListener('click', () => {
    myRole = 'gm';
    switchScreen('gm');
    socket.emit('join', { role: 'gm' });
});

playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnJoinPlayer.click();
});

// Event Listeners for GM
btnStart.addEventListener('click', () => {
    socket.emit('start-game', { roomName: (gmRoomNameInput ? gmRoomNameInput.value.trim() : '') || 'Tap Tap Championship' });
});

btnReset.addEventListener('click', () => {
    socket.emit('reset-game');
});

btnCloseRoom.addEventListener('click', () => {
    if (confirm("Are you sure you want to close the room? All players will be kicked.")) {
        socket.emit('close-room');
    }
});

// Event Listeners for Player
const tapCircleElement = tapButton ? tapButton.querySelector('.tap-circle') : null;

function addPress() {
    if (tapCircleElement && !isCountdownActive) tapCircleElement.classList.add('pressed');
}

function removePress() {
    if (tapCircleElement) tapCircleElement.classList.remove('pressed');
}

tapButton.addEventListener('mousedown', (e) => {
    if (!e.touches) {
        addPress();
        handleTap(e);
    }
});
tapButton.addEventListener('mouseup', removePress);
tapButton.addEventListener('mouseleave', removePress);

tapButton.addEventListener('touchstart', (e) => {
    e.preventDefault(); // prevent mouse event emulation
    addPress();
    handleTap(e);
});
tapButton.addEventListener('touchend', removePress);
tapButton.addEventListener('touchcancel', removePress);

// Server Event Handlers
socket.on('update-players', (players) => {
    // Sort players by score descending
    players.sort((a, b) => b.score - a.score);

    // Update GM View
    if (myRole === 'gm') {
        btnStart.disabled = players.length === 0;

        gmPlayersList.innerHTML = '';
        players.forEach(p => {
            const percentage = Math.min((p.score / MAX_SCORE) * 100, 100);
            const card = document.createElement('div');
            card.className = 'player-card fade-in';
            card.innerHTML = `
                <div class="card-header">
                    <span>${p.name}</span>
                    <span class="card-score">${p.score}</span>
                </div>
                <div class="progress-mini-bg">
                    <div class="progress-mini-fill" style="width: ${percentage}%"></div>
                </div>
            `;
            gmPlayersList.appendChild(card);
        });
    }

    // Update Player Leaderboard View
    if (myRole === 'player') {
        playerLeaderboard.innerHTML = '';
        players.forEach((p, index) => {
            const isMe = p.id === socket.id;
            const item = document.createElement('li');
            item.className = `leader-item ${isMe ? 'me' : ''}`;
            item.innerHTML = `
                <span>${index === 0 ? '👑 ' : ''}${index + 1}. ${p.name}</span>
                <span class="score-badge">${p.score}</span>
            `;
            playerLeaderboard.appendChild(item);
        });
    }
});

socket.on('game-state', (data) => {
    if (data.state === 'waiting') uiStateToWaiting();
    else if (data.state === 'playing') uiStateToPlaying();
    else if (data.state === 'finished') uiStateToFinished(data.winner, data.roomName);
});

socket.on('game-started', () => {
    // Apply 3-2-1 countdown logic
    if (myRole === 'player') {
        isCountdownActive = true;
        overlayWaiting.classList.add('hidden');
        overlayCountdown.classList.remove('hidden');

        // Play BGM
        try {
            bgmAudio.currentTime = 0;
            bgmAudio.play().catch(err => console.log('Audio playback blocked pending user interaction', err));
        } catch (e) { }

        let count = 3;
        countdownNumber.innerText = count;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownNumber.innerText = count;
                // retrigger animation
                countdownNumber.classList.remove('pulse');
                void countdownNumber.offsetWidth;
                countdownNumber.classList.add('pulse');
            } else if (count === 0) {
                countdownNumber.innerText = "GO!";
            } else {
                clearInterval(interval);
                isCountdownActive = false;
                uiStateToPlaying();
            }
        }, 1000);
    } else if (myRole === 'gm') {
        uiStateToPlaying();
    }
});

socket.on('update-score', (data) => {
    if (myRole === 'player' && data.id === socket.id) {
        updateProgress(data.score);
    }
    // No need to update leaderboard here as update-players is optimized,
    // but in a more complex app we'd just update the specific element.
    // For simplicity, we are listening to update-players to redraw leaderboard.
});

socket.on('game-over', (data) => {
    uiStateToFinished(data.winner, data.roomName);
});

socket.on('game-reset', () => {
    uiStateToWaiting();
});

socket.on('room-closed', () => {
    alert("The Game Master has closed the room.");
    window.location.reload();
});

// UI State Management Logic
function uiStateToWaiting() {
    updateProgress(0);

    if (myRole === 'gm') {
        gmGameStatus.className = 'status-badge waiting';
        gmGameStatus.innerText = 'Status: Waiting';
        btnStart.disabled = gmPlayersList.children.length === 0;
        gmWinnerAnnouncement.classList.add('hidden');

        // Removed winner styles
        document.querySelectorAll('.player-card').forEach(c => c.classList.remove('winner-card'));

        try {
            bgmAudio.pause();
            bgmAudio.currentTime = 0;
        } catch (e) { }
    }

    if (myRole === 'player') {
        playerGameStatus.innerText = 'Status: Waiting';
        overlayWaiting.classList.remove('hidden');
        overlayCountdown.classList.add('hidden');
        overlayFinished.classList.add('hidden');

        try {
            bgmAudio.pause();
            bgmAudio.currentTime = 0;
        } catch (e) { }
    }
}

function uiStateToPlaying() {
    isCountdownActive = false;
    if (myRole === 'gm') {
        gmGameStatus.className = 'status-badge playing';
        gmGameStatus.innerText = 'Status: LIVE';
        btnStart.disabled = true;
        gmWinnerAnnouncement.classList.add('hidden');
    }

    if (myRole === 'player') {
        playerGameStatus.innerText = 'Status: GAME ON!';
        overlayWaiting.classList.add('hidden');
        overlayCountdown.classList.add('hidden');
        overlayFinished.classList.add('hidden');
    }
}

function uiStateToFinished(winner, roomName) {
    let finalRoomName = roomName || 'Tap Tap Championship';

    if (myRole === 'gm') {
        gmGameStatus.className = 'status-badge finished';
        gmGameStatus.innerText = 'Status: Finished';
        btnStart.disabled = true;

        gmWinnerAnnouncement.classList.remove('hidden');
        gmWinnerText.innerText = `${winner} (memenangkan ${finalRoomName})`;

        try { bgmAudio.pause(); } catch (e) { }
    }

    if (myRole === 'player') {
        playerGameStatus.innerText = 'Status: Game Over';
        overlayFinished.classList.remove('hidden');
        winnerNameText.innerText = winner;

        if (resultRoomName && resultTitle) {
            if (myName === winner) {
                resultTitle.innerText = "🎉 SELAMAT! 🎉";
                resultRoomName.innerText = `Anda Memenangkan ${finalRoomName}`;
                resultRoomName.style.color = '#34d399';
                if (resultSubtitle) resultSubtitle.style.display = 'none';
            } else {
                resultTitle.innerText = "Game Over!";
                resultRoomName.innerText = `Memenangkan ${finalRoomName}`;
                resultRoomName.style.color = 'var(--accent)';
                if (resultSubtitle) resultSubtitle.style.display = 'block';
            }
        }

        try { bgmAudio.pause(); } catch (e) { }
    }

    // Play confetti for both GM and Player view when someone wins
    triggerConfetti();
}
