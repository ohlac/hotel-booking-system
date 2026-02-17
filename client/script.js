// API-adress till backend
const API_länk = 'https://hotel-api-67w7.onrender.com';

// HTML-element
const roomsContainer = document.getElementById('rooms-container');
const loginForm = document.querySelector('.login-form');

// Kontrollera om användare är inloggad
async function checkLoginStatus() {
  try {
    const response = await fetch(`${API_länk}/api/check-auth`, {
      credentials: 'include'
    });

    const data = await response.json();

    if (data.loggedIn) {
      updateNavForLoggedInUser(data.user.role);

      const welcomeText = document.querySelector('#user-welcome');
      if (welcomeText) {
        welcomeText.textContent = `Welcome back, ${data.user.username}!`;
      }
    }

    if (window.location.pathname.includes('user.html') && !data.loggedIn) {
      window.location.href = 'login.html';
    }

    if (window.location.pathname.includes('admin.html')) {
      if (!data.loggedIn || data.user.role !== 'admin') {
        window.location.href = 'index.html';
      }
    }

  } catch (error) {
    console.error('Fel vid kontroll av login:', error);
  }
}

// Uppdatera navigation när inloggad
function updateNavForLoggedInUser(role) {
  const loginBtn = document.querySelector('a[href="login.html"]');

  if (loginBtn) {
    loginBtn.textContent = "Log Out";
    loginBtn.href = "#";
    loginBtn.addEventListener('click', logoutUser);
  }

  if (role === 'admin') {
    const adminBtn = document.querySelector('.admin-hidden');
    if (adminBtn) {
      adminBtn.style.display = 'block';
      adminBtn.classList.remove('admin-hidden');
    }
  }
}

// Logga ut användare
async function logoutUser(e) {
  e.preventDefault();
  try {
    await fetch(`${API_länk}/api/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Logout-fel:', error);
  }
}

checkLoginStatus();

// Login-formulär
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = loginForm.querySelector('input[type="text"]').value;
    const password = loginForm.querySelector('input[type="password"]').value;

    try {
      const response = await fetch(`${API_länk}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();

      if (result.loggedIn) {
        if (result.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'user.html';
        }
      } else {
        alert("Login failed: " + result.message);
      }

    } catch (error) {
      console.error('Login-fel:', error);
    }
  });
}

// Hämta rum från backend
if (roomsContainer) {
  getRooms();
}

async function getRooms() {
  try {
    const response = await fetch(`${API_länk}/api/rooms`);
    if (!response.ok) throw new Error('Servern svarar inte');

    const rooms = await response.json();
    roomsContainer.innerHTML = '';

    rooms.forEach(room => {

      let imagePath = 'images/single.jpg';
      if (room.type === 'Double') imagePath = 'images/double.jpg';
      if (room.type === 'Suite') imagePath = 'images/suite.jpg';

      let capacity = 1;
      if (room.type === 'Double') capacity = 3;
      if (room.type === 'Suite') capacity = 5;

      const roomCard = document.createElement('article');
      roomCard.classList.add('room-card');
      roomCard.dataset.capacity = capacity;

      roomCard.innerHTML = `
        <div class="room-text">
          <h3 class="room-title">Room ${room.room_number} - ${room.type}</h3>
          <p class="room-desc">${room.description}</p>
          <p class="room-desc"><b>Price: ${room.price_per_night} kr/night</b></p>
          <p class="room-capacity">Max ${capacity} guests</p>
          <button class="search-btn">Book</button>
        </div>
        <div class="room-image">
          <img src="${imagePath}" alt="${room.type}">
        </div>
      `;

      roomsContainer.appendChild(roomCard);
    });

  } catch (error) {
    console.error('Fel vid hämtning av rum:', error);
    roomsContainer.innerHTML = `<p style="color:red;text-align:center;">Kunde inte hämta rum</p>`;
  }
}

// Hotell-bildslider
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
  const modalLeft = document.querySelector(".modal-arrow.left");
  const modalRight = document.querySelector(".modal-arrow.right");

  if (!slider) return;

  function showImage(i) {
    slider.style.backgroundImage = `url("${images[i]}")`;
  }

  function showModal(i) {
    modal.style.display = "flex";
    modalImg.src = images[i];
  }

  if (leftBtn) {
    leftBtn.onclick = () => {
      current = (current - 1 + images.length) % images.length;
      showImage(current);
    };
  }

  if (rightBtn) {
    rightBtn.onclick = () => {
      current = (current + 1) % images.length;
      showImage(current);
    };
  }

  slider.onclick = () => showModal(current);

  if (modalLeft) {
    modalLeft.onclick = () => {
      current = (current - 1 + images.length) % images.length;
      modalImg.src = images[current];
    };
  }

  if (modalRight) {
    modalRight.onclick = () => {
      current = (current + 1) % images.length;
      modalImg.src = images[current];
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => modal.style.display = "none";
  }

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) modal.style.display = "none";
    };
  }

  showImage(current);
});

// Gäst-filter
let adults = 1;
let children = 0;

function toggleGuests() {
  const box = document.getElementById("guests-dropdown");
  if (box) {
    box.style.display = box.style.display === "block" ? "none" : "block";
  }
}

function changeAdults(val) {
  adults = Math.max(1, adults + val);
  updateGuests();
}

function changeChildren(val) {
  children = Math.max(0, children + val);
  updateGuests();
}

function updateGuests() {
  document.getElementById("adults-count").textContent = adults;
  document.getElementById("children-count").textContent = children;

  let text = adults + " Adult";
  if (adults > 1) text += "s";

  if (children > 0) {
    text += ", " + children + " Child";
    if (children > 1) text += "ren";
  }

  document.getElementById("guests-text").textContent = text;
}

function filterRoomsByGuests() {
  const totalGuests = adults + children;
  const cards = document.querySelectorAll(".room-card");

  cards.forEach(card => {
    const capacity = parseInt(card.dataset.capacity || "0", 10);
    card.style.display = capacity >= totalGuests ? "" : "none";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("searchBtn");
  if (btn) {
    btn.addEventListener("click", filterRoomsByGuests);
  }
});
