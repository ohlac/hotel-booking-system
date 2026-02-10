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
            
            // Skapa kortet
            const roomCard = document.createElement('article');
            roomCard.classList.add('room-card');

            // Fyll kortet med innehåll. 
            roomCard.innerHTML = `
                <div class="room-text">
                    <h3 class="room-title">Rum ${room.room_number} - ${room.type}</h3>
                    <p class="room-desc">${room.description}</p>
                    <p class="room-desc" style="font-weight: bold;">Pris: ${room.price_per_night} kr/natt</p>
                    <button class="search-btn" style="margin-top: 10px;" onclick="alert('Boka-funktion kommer snart!')">Boka</button>
                </div>
                <div class="img-placeholder">
                    Bild på ${room.type}
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