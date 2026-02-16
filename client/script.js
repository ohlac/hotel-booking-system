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
// hotel slider
document.addEventListener("DOMContentLoaded", () => {
  const images = [
    "images/1.jpg","images/2.jpg","images/3.jpg","images/4.jpg","images/5.jpg",
    "images/6.jpg","images/7.jpg","images/8.jpg","images/9.jpg","images/10.jpg",
    "images/11.jpg","images/12.jpg","images/13.jpg","images/14.jpg","images/15.jpg",
    "images/16.jpg","images/17.jpg","images/18.jpg","images/19.jpg","images/20.jpg",
    "images/21.jpg","images/22.jpg","images/23.jpg"
  ];

  let current = 0;

  const slider = document.getElementById("sliderImg");
  const leftBtn = document.querySelector(".slider-arrow.left");
  const rightBtn = document.querySelector(".slider-arrow.right");

  const modal = document.getElementById("imgModal");
  const modalImg = document.getElementById("imgModalContent");
  const closeBtn = document.querySelector(".img-close");

  if (!slider || !leftBtn || !rightBtn) return;

  function showImage(i) {
    slider.style.backgroundImage = `url("${images[i]}")`;
  }

  leftBtn.addEventListener("click", () => {
    current = (current - 1 + images.length) % images.length;
    showImage(current);
  });

  rightBtn.addEventListener("click", () => {
    current = (current + 1) % images.length;
    showImage(current);
  });

  showImage(current);

  if (modal && modalImg && closeBtn) {
    slider.addEventListener("click", () => {
      modal.style.display = "flex";
      modalImg.src = images[current];
    });

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  }
});
