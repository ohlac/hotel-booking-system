const API_länk = 'https://hotel-api-67w7.onrender.com/api/rooms';

const roomsContainer = document.getElementById('rooms-container');

async function getRooms() {
    try {
        // Hämta data från Backend
        const response = await fetch(API_länk);
        
        if (!response.ok) {
            throw new Error('Kunde inte nå servern');
        }

        const rooms = await response.json();

        // Töm containern på "Laddar..."-texten
        roomsContainer.innerHTML = '';

        // Loopa igenom varje rum och skapa HTML
        rooms.forEach(room => {
            let imagePath = '';
            if (room.type === 'Enkelrum') {
                imagePath = 'images/single.jpg';
            } else if (room.type === 'Dubbelrum') {
                imagePath = 'images/double.jpg';
            } else {
                imagePath = 'images/suite.jpg';
            }
            // Skapa kortet
            const roomCard = document.createElement('article');
            roomCard.classList.add('room-card');

            // Fyll kortet med innehåll. 
            roomCard.innerHTML = `
                 <div class="room-text">
                    <h3 class="room-title">Room ${room.room_number} - ${room.type}</h3>
                    <p class="room-desc">${room.description}</p>
                    <p class="room-desc" style="font-weight: bold;">
                        Price: ${room.price_per_night} kr/night
                    </p>
                    <button class="search-btn" onclick="alert('Booking coming soon!')">
                        Book
                    </button>
                </div>
                <div class="room-image">
                    <img src="${imagePath}" alt="${room.type}">
                </div>
            `;
            // Lägg in kortet i containern
            roomsContainer.appendChild(roomCard);
        });

    } catch (error) {
        console.error('Fel:', error);
        roomsContainer.innerHTML = `
            <p style="text-align: center; color: red; grid-column: 1/-1;">
                Kunde inte hämta rummen just nu.<br>
                Kontrollera att din Backend på Render är igång.
            </p>`;
    }
}

// Kör funktionen direkt när sidan laddas
getRooms();