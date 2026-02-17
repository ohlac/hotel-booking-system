const API_länk = 'https://hotel-api-67w7.onrender.com';

const roomsContainer = document.getElementById('rooms-container');
const loginForm = document.querySelector('.login-form'); 

async function checkLoginStatus() {
    try {
        // Skickar med cookies för att se vem som är inloggad
        const response = await fetch(`${API_länk}/api/check-auth`, { credentials: 'include' });
        const data = await response.json();

        if (data.loggedIn) {
            console.log('Användare är inloggad som:', data.user.role);
            updateNavForLoggedInUser(data.user.role);

            const welcomeText = document.querySelector('user-welcome');
            if (welcomeText) welcomeText.textContent = `Welcome back, ${data.user.username}!`;       
        }

        // Skydda user-sidan om man inte är inloggad
        if (window.location.pathname.includes('user.html') && !data.loggedIn) {
            window.location.href = 'login.html';
        }

        // Skydda admin
        if (window.location.pathname.includes('admin.html')) {
            if (!data.loggedIn || data.user.role !== 'admin') {
                console.warn('Åtkomst nekad: Ej admin');
                window.location.href = 'index.html';
            }
        }
    } catch (error) {
        console.error('Kunde inte kolla inloggningsstatus:', error);
    }
}

function updateNavForLoggedInUser(role) {
    // Ändra Log In till Log Out
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
            adminBtn.style.display = 'block';
            adminBtn.classList.remove('admin-hidden');
        }
    }
}

async function logoutUser(e) {
    e.preventDefault();
    try {
        // Logga ut och rensa sessionen
        await fetch(`${API_länk}/api/logout`, { method: 'POST', credentials: 'include' });
        window.location.href = 'index.html'; 
    } catch (error) {
        console.error('Fel vid utloggning:', error);
    }
}

checkLoginStatus();

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Hitta inputs i formuläret
        const usernameInput = loginForm.querySelector('input[type="text"]');
        const passwordInput = loginForm.querySelector('input[type="password"]');

        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            // Skicka inloggning till servern
            const response = await fetch(`${API_länk}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Viktigt för att spara kakan
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (result.loggedIn) {
                alert('Login successful!');
                if (result.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'user.html'; // Skicka till user page
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
        const response = await fetch(`${API_länk}/api/rooms`);
        if (!response.ok) throw new Error('Kunde inte nå servern');
        
        const rooms = await response.json();
        roomsContainer.innerHTML = '';

        rooms.forEach(room => {
            let imagePath = 'single.jpg'; // Default bild
            if (room.type === 'Double') imagePath = 'double.jpg';
            if (room.type === 'Suite') imagePath = 'suite.jpg';

            const roomCard = document.createElement('article');
            roomCard.classList.add('room-card');

            roomCard.innerHTML = `
                 <div class="room-text">
                    <h3 class="room-title">Room ${room.room_number} - ${room.type}</h3>
                    <p class="room-desc">${room.description}</p>
                    <p class="room-desc" style="font-weight: bold;">Price: ${room.price_per_night} kr/night</p>
                    <button class="search-btn" onclick="alert('Booking coming soon!')">Book</button>
                </div>
                <div class="room-image-container">
                    <img src="images/rooms/${imagePath}" alt="${room.type} room" class="room-image">
                </div>
            `;
            roomsContainer.appendChild(roomCard);
        });

    } catch (error) {
        console.error('Fel:', error);
        roomsContainer.innerHTML = `<p style="text-align:center; color:red;">Kunde inte hämta rum.</p>`;
    }
}



// Bildslider på hotel-info.html
const sliderImg = document.querySelector('.slider-img');

if (sliderImg) {
    const images = [
        'images/hotel/1.jpg',
        'images/hotel/2.jpg',
        'images/hotel/3.jpg',
        'images/hotel/4.jpg',
        'images/hotel/5.jpg',
        'images/hotel/6.jpg',
        'images/hotel/7.jpg'
    ];

    let currentImageIndex = 0;
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    function showImage() {
        sliderImg.style.backgroundImage = `url(${images[currentImageIndex]})`;
    }

    // Klicka på vänsterpil
    prevBtn.addEventListener('click', () => {
        currentImageIndex --;
        if (currentImageIndex < 0) currentImageIndex = images.length - 1;
        showImage();
    });

    //Klicka på högerpil
    nextBtn.addEventListener('click', () => {
        currentImageIndex ++;
        if (currentImageIndex >= images.length) currentImageIndex = 0;
        showImage();
    });

    // Visa första bilden direkt
    showImage();

}