const API_länk = 'https://hotel-api-67w7.onrender.com';

const roomsContainer = document.getElementById('rooms-container');
const loginForm = document.getElementById('login-form');

async function checkLoginStatus() {
    try {
        const response = await fetch('${API_länk}/api/check-auth');
        const data = await response.json();

        if (data.loggedIn) {
            console.log('Användare är inloggad som:', data.user.role);
            updateNavForLoggedInUser(data.user.role);
        }

        if (window.location.pathname.includes('user.html') && !data.loggedIn) {
            window.location.href = 'login.html'; // Omdirigera till login-sidan om inte inloggad
        }
    } catch (error) {
        console.error('Kunde inte kolla inloggningsstatus:', error);
    }
}

function updateNavForLoggedInUser(role) {
    // Ändra "Log In" till "Log Out"
    const loginBtn = document.querySelector('a[href="login.html"]');
    if (loginBtn) {
        loginBtn.textContent = "Log Out";
        loginBtn.href = "#";
        loginBtn.addEventListener('click', logoutUser);
    }

    // Visa admin-knappen om användaren är admin
    if (role === 'admin') {
        const adminBtn = document.querySelector('.admin-hidden');
        if(adminBtn) {
            adminBtn.computedStyleMap.display = 'block'; // Visa admin-knappen
            adminBtn.classList.remove('admin-hidden');
        }
    }
}

async function logoutUser(e) {
    e.preventDefault();
    await fetch('${API_länk}/api/logout', { method: 'POST' });
    window.location.href = 'index.html'; // Omdirigera till startsidan
}

checkLoginStatus();

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.querySelector('input[type="text"]');
        const passwordInput = document.querySelector('input[type="password"]');

        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch('${API_länk}/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (result.loggedIn) {
                alert('Login successful!');
                if (result.role === 'admin') {
                    window.location.href = 'admin.html'; // Skicka admin till admin-sidan
                } else {
                    window.location.href = 'index.html'; // Skicka vanlig user till startsidan
                }
            } else {
                alert("Login failed: " + result.message);
            }
        } catch (error) {
            console.error('Login error: ', error);
            alert('An error occurred while trying to log in.');
        }
    });
}



if (roomsContainer) {
    getRooms();
}

async function getRooms() {
    try {
        const response = await fetch(`${API_BASE}/api/rooms`);
        if (!response.ok) throw new Error('Kunde inte nå servern');
        
        const rooms = await response.json();
        roomsContainer.innerHTML = '';

        rooms.forEach(room => {
            let imagePath = 'images/single.jpg'; // Default bild
            if (room.type === 'Double') imagePath = 'images/double.jpg';
            if (room.type === 'Suite') imagePath = 'images/suite.jpg';

            const roomCard = document.createElement('article');
            roomCard.classList.add('room-card');
            roomCard.innerHTML = `
                 <div class="room-text">
                    <h3 class="room-title">Room ${room.room_number} - ${room.type}</h3>
                    <p class="room-desc">${room.description}</p>
                    <p class="room-desc" style="font-weight: bold;">Price: ${room.price_per_night} kr/night</p>
                    <button class="search-btn" onclick="alert('Booking coming soon!')">Book</button>
                </div>
                <div class="img-placeholder">Bild: ${room.type}</div>
            `;
            roomsContainer.appendChild(roomCard);
        });

    } catch (error) {
        console.error('Fel:', error);
        roomsContainer.innerHTML = `<p style="text-align:center; color:red;">Kunde inte hämta rum.</p>`;
    }
}