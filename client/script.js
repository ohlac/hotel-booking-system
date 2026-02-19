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

// Language switch
const translations = {
  en: {
    // NAV
    navFind: "Find a Room",
    navInfo: "Hotel Information",
    navUser: "User Page / Bookings",
    navLogin: "Log In",
    navAdmin: "Admin",

    // HOME
    heroWelcome: "Welcome to Hotel California",
    heroText: "Find available rooms below!",
    roomSingle: "Single Rooms have 1 king-size bed",
    roomDouble: "Double Rooms have 2 king-size beds",
    roomSuite: "Suite Rooms have 1 king-size bed and a separate sitting area",
    findTitle: "Find a Room",
    checkin: "Check-in date",
    checkout: "Check-out date",
    roomType: "Room type",
    search: "Search",
    availableRooms: "Available Rooms",
    loadingRooms: "Loading Rooms...",

    // HOTEL INFO
    hotelTitle: "Hotel California",
    descTitle: "Description",
    hotelPics: "Pictures of the Hotel",
    hotelDesc1: "Experience comfort and elegance at Hotel California, a welcoming retreat in the heart of Trollhättan.",
    hotelDesc2: "Our thoughtfully designed rooms combine modern comfort with a warm atmosphere, creating the perfect place to relax after a long day.",
    hotelDesc3: "Guests enjoy complimentary breakfast each morning along with attentive service throughout their stay.",
    hotelDesc4: "Whether you're here for a romantic getaway or a family vacation, Hotel California has something for everyone.",
    hotelDesc5: "If you have any questions, please don't hesitate to contact us!",
    hotelDesc6: "Contact information can be found at the bottom of the page.",


    // BOOKING CONFIRMATION
    bookingConfirmed: "Booking Confirmed ✓",
    bookingThanks: "Thank you for booking a room with us!",
    bookingSeeYou: "We will see you on",

    // ADMIN
    adminCurrentBookings: "Current Bookings",
    adminManageRooms: "Manage Rooms",
    adminTotalBookings: "Total Current Bookings",
    adminAvailableRooms: "Available Rooms",
    adminBookedFor: "Booked for",
    imgText: "Image",

    // LOGIN
    loginInfoText: "Log in to manage your room bookings and adjust user settings",
    username: "Username",
    password: "Password",
    registerLink: "Not a user yet? Register Here",

    // REGISTER
    registerInfo: "Register to manage your room bookings and adjust user settings",
    email: "E-Mail",
    fullName: "Full Name",
    repeatPassword: "Repeat Password",
    registerBtn: "Register",

    // SEARCH
    resultsTitle: "Results for search",

    // USER
    userMyBookings: "My Bookings",
    userSettings: "User Settings",
    userWelcome: "Welcome back",
    userBookingsTitle: "Your Bookings",
    cancelBooking: "Cancel Booking",

    // FOOTER
    contactInfo: "Contact Information",
    address: "Address",
    open24: "Reception Open 24 Hours",
    copyright: "Copyright"
  },

  sv: {
    // NAV
    navFind: "Hitta ett rum",
    navInfo: "Hotellinformation",
    navUser: "Användarsida / Bokningar",
    navLogin: "Logga in",
    navAdmin: "Admin",

    // HOME
    heroWelcome: "Välkommen till Hotel California",
    heroText: "Hitta lediga rum nedan!",
    roomSingle: "Enkelrum har 1 king size-säng",
    roomDouble: "Dubbelrum har 2 king size-sängar",
    roomSuite: "Svitrum har 1 king size-säng och separat sittdel",
    findTitle: "Hitta ett rum",
    checkin: "Incheckningsdatum",
    checkout: "Utcheckningsdatum",
    roomType: "Rumstyp",
    search: "Sök",
    availableRooms: "Tillgängliga rum",
    loadingRooms: "Laddar rum...",

    // HOTEL INFO
    hotelTitle: "Hotel California",
    descTitle: "Beskrivning",
    hotelPics: "Bilder på hotellet",
    hotelDesc1: "Upplev komfort och elegans på Hotel California, en välkomnande oas i hjärtat av Trollhättan.",
    hotelDesc2: "Våra genomtänkta rum kombinerar modern komfort med en varm atmosfär, perfekt för avkoppling efter en lång dag.",
    hotelDesc3: "Gästerna njuter av kostnadsfri frukost varje morgon samt personlig service under hela vistelsen.",
    hotelDesc4: "Oavsett om du är här för en romantisk resa eller familjesemester har Hotel California något för alla.",
    hotelDesc5: "Om du har några frågor, tveka inte att kontakta oss!",
    hotelDesc6: "Kontaktinformation finns längst ner på sidan.",


    // BOOKING
    bookingConfirmed: "Bokning bekräftad ✓",
    bookingThanks: "Tack för din bokning!",
    bookingSeeYou: "Vi ses",

    // ADMIN
    adminCurrentBookings: "Aktuella bokningar",
    adminManageRooms: "Hantera rum",
    adminTotalBookings: "Totala bokningar",
    adminAvailableRooms: "Lediga rum",
    adminBookedFor: "Bokad för",
    imgText: "Bild",

    // LOGIN
    loginInfoText: "Logga in för att hantera dina bokningar och inställningar",
    username: "Användarnamn",
    password: "Lösenord",
    registerLink: "Inte användare än? Registrera här",

    // REGISTER
    registerInfo: "Registrera dig för att hantera dina bokningar",
    email: "E-post",
    fullName: "Fullständigt namn",
    repeatPassword: "Upprepa lösenord",
    registerBtn: "Registrera",

    // SEARCH
    resultsTitle: "Sökresultat",

    // USER
    userMyBookings: "Mina bokningar",
    userSettings: "Användarinställningar",
    userWelcome: "Välkommen tillbaka",
    userBookingsTitle: "Dina bokningar",
    cancelBooking: "Avboka",

    // FOOTER
    contactInfo: "Kontaktinformation",
    address: "Adress",
    open24: "Reception öppen 24 timmar",
    copyright: "Copyright"
  }
};

function setLanguage(lang){
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });

  localStorage.setItem("lang", lang);

  const btn = document.getElementById("langBtn");
  if(btn){
    btn.textContent = lang.toUpperCase();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("lang") || "en";
  setLanguage(savedLang);

  const btn = document.getElementById("langBtn");
  if(btn){
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const current = localStorage.getItem("lang") || "en";
      const next = current === "en" ? "sv" : "en";
      setLanguage(next);
    });
  }
});
