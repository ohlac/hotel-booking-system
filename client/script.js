// Adress till api
const API_länk ="https://hotel-api-67w7.onrender.com";
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
// Registrering
const registerForm = document.querySelector('.register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const username = document.getElementById('reg-username').value;
    const fullName = document.getElementById('reg-fullname').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    try {
      const response = await fetch(`${API_länk}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, fullName, password })
      });
      const result = await response.json();
      if (response.ok) {
        alert("Registration successful!");
        window.location.href = 'login.html';
      } else {
        alert("Registration failed: " + result.message);
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert("An error occurred during registration.");
    }
  });
}
// ==========================================
// SÖK, BOKA OCH VISA RUM
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
   
    // 1. Sökformuläret (Stoppar reload och filtrerar rum)
    const searchForm = document.getElementById('search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Stoppar sidan från att blinka/ladda om
            const start = document.getElementById('search-start').value;
            const end = document.getElementById('search-end').value;
            const type = document.getElementById('search-type').value;
            // Kontrollera så utcheckning inte är innan incheckning
            if (new Date(start) >= new Date(end)) {
                alert("Check-out date must be after check-in date!");
                return;
            }
            getRooms(start, end, type);
        });
    }
    // 2. Ladda rum om på index.html
    if (document.getElementById('rooms-container')) {
        getRooms();
    }
    // 3. Ladda bokningar om på user.html
    if (document.getElementById('bookings-list')) {
        getUserBookings();
    }
});
async function getRooms(start = '', end = '', type = '') {
  const roomsContainer = document.getElementById('rooms-container');
  if (!roomsContainer) return;
 
  try {
      let url = `${API_länk}/api/rooms`;
      if (start && end) {
          url += `?start=${start}&end=${end}&type=${type}`;
      }
      const response = await fetch(url);
      const rooms = await response.json();
      roomsContainer.innerHTML = ''; // Tömmer rutan
      if (rooms.length === 0) {
          roomsContainer.innerHTML = `<p style="text-align:center; width:100%;">No available rooms found for these dates.</p>`;
          return;
      }
      rooms.forEach(room => {
          let imagePath = 'single.jpg';
          if (room.type === 'Double') imagePath = 'double.jpg';
          if (room.type === 'Suite') imagePath = 'suite.jpg';
          const roomCard = document.createElement('article');
          roomCard.classList.add('room-card');
          roomCard.innerHTML = `
               <div class="room-text">
                  <h3 class="room-title">Room ${room.room_number} - ${room.type}</h3>
                  <p class="room-desc">${room.description}</p>
                  <p class="room-desc" style="font-weight: bold; color: #d4af37;">Price: ${room.price_per_night} kr/night</p>
                  <button class="search-btn" onclick="bookRoom(${room.id})">Book Room</button>
              </div>
              <div class="room-image-container">
                  <img src="images/rooms/${imagePath}" alt="${room.type} room" class="room-image">
              </div>
          `;
          roomsContainer.appendChild(roomCard);
      });
  } catch (error) {
      console.error('Fel vid hämtning av rum:', error);
      roomsContainer.innerHTML = `<p style="text-align:center; color:red;">Kunde inte hämta rum.</p>`;
  }
}
window.bookRoom = async function(roomId) {
  const startInput = document.getElementById('search-start');
  const endInput = document.getElementById('search-end');
 
  if (!startInput || !endInput || !startInput.value || !endInput.value) {
      alert("Please search for available dates in the panel above before booking a room!");
      return;
  }
  const startDate = startInput.value;
  const endDate = endInput.value;
  try {
      const response = await fetch(`${API_länk}/api/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ roomId, startDate, endDate })
      });
      if (response.ok) {
          alert("Room successfully booked! View it on your User Page.");
          const type = document.getElementById('search-type').value;
          getRooms(startDate, endDate, type); // Laddar om listan så rummet försvinner
      } else {
          // Skydd mot "Unexpected token <" om Render svarar med en felsida
          const isJson = response.headers.get('content-type')?.includes('application/json');
          const data = isJson ? await response.json() : null;
          const errorMsg = data ? data.message : "You need to log in first or backend is missing.";
         
          alert("Booking failed: " + errorMsg);
          if(response.status === 401 || errorMsg.includes("log in")) window.location.href = "login.html";
      }
  } catch (error) {
      console.error("Bokningsfel:", error);
      alert("Network error. Server might be restarting.");
  }
}
async function getUserBookings() {
  const listContainer = document.getElementById('bookings-list');
  if (!listContainer) return;
  try {
      const response = await fetch(`${API_länk}/api/user/bookings`, { credentials: 'include' });
     
      if (!response.ok) throw new Error("Ej inloggad eller serverfel");
      const bookings = await response.json();
      listContainer.innerHTML = ''; // Rensar "Loading your bookings..."
      if (bookings.length === 0) {
          listContainer.innerHTML = "<p>You have no current bookings.</p>";
          return;
      }
      bookings.forEach(b => {
          const card = document.createElement('article');
          card.classList.add('user-booking-card');
         
          const start = new Date(b.start_date).toLocaleDateString();
          const end = new Date(b.end_date).toLocaleDateString();
          let imagePath = 'single.jpg';
          if (b.type === 'Double') imagePath = 'double.jpg';
          if (b.type === 'Suite') imagePath = 'suite.jpg';
          card.innerHTML = `
              <div class="user-lines">
                  <div class="line-title">Room ${b.room_number}</div>
                  <div class="line">Type: ${b.type}</div>
                  <div class="line">Start Date: ${start}</div>
              </div>
              <div class="user-dates">
                  <div class="end-date">End Date: ${end}</div>
                  <button class="cancel-btn" onclick="cancelBooking(${b.booking_id})">Cancel Booking</button>
              </div>
              <div class="user-img" style="background-image: url('images/rooms/${imagePath}'); background-size: cover; background-position: center;"></div>
          `;
          listContainer.appendChild(card);
      });
  } catch (error) {
      console.error("Fel vid hämtning:", error);
      listContainer.innerHTML = "<p>Logga in för att se dina bokningar.</p>";
  }
}
window.cancelBooking = async function(bookingId) {
  if (!confirm("Are you sure you want to cancel this booking?")) return;
  try {
      const response = await fetch(`${API_länk}/api/bookings/${bookingId}`, {
          method: 'DELETE',
          credentials: 'include'
      });
      if (response.ok) {
          getUserBookings(); // Ladda om listan direkt efter avbokning
      } else {
          alert("Kunde inte avboka.");
      }
  } catch (error) {
      console.error(error);
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
// Visa användarinställningar
function showSettings(){
  document.getElementById("bookings-section").style.display = "none";
  document.getElementById("user-settings").style.display = "block";
}
// visa bokningar
function showBookings(){
  document.getElementById("bookings-section").style.display = "block";
  document.getElementById("user-settings").style.display = "none";
}
// Save user settingss
const saveBtn = document.getElementById("save-user-settings");
if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const email = document.getElementById("user-email").value;
    const password = document.getElementById("user-password").value;
    try {
      const response = await fetch(`${API_länk}/api/update-user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email: email,
          password: password
        })
      });
      const result = await response.json();
      if (response.ok) {
        document.getElementById("settings-message").textContent = "Settings updated successfully!";
      } else {
        alert("Error: " + result.message);
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    }
  });
}
async function getUserBookings() {
  const bookingsContainer = document.querySelector('#bookings-section');
  if (!bookingsContainer) return;
  try {
      const response = await fetch(`${API_länk}/api/user/bookings`, { credentials: 'include' });
      const bookings = await response.json();
      // rensa gamla bokningskort
      const welcomeHtml = bookingsContainer.querySelector('.user-welcome').outerHTML;
      const titleHtml = bookingsContainer.querySelector('.user-title').outerHTML;
      bookingsContainer.innerHTML = welcomeHtml + titleHtml;
      if (bookings.length === 0) {
          bookingsContainer.innerHTML += "<p>Du har inga aktiva bokningar.</p>";
          return;
      }
      bookings.forEach(b => {
          const card = document.createElement('article');
          card.classList.add('user-booking-card');
         
          // Formatera datum snyggt
          const start = new Date(b.start_date).toLocaleDateString();
          const end = new Date(b.end_date).toLocaleDateString();
          card.innerHTML = `
              <div class="user-lines">
                  <div class="line-title">Room ${b.room_number}</div>
                  <div class="line">Type: ${b.type}</div>
                  <div class="line">Start: ${start}</div>
              </div>
              <div class="user-dates">
                  <div class="end-date">End: ${end}</div>
                  <button class="cancel-btn" onclick="cancelBooking(${b.booking_id})">Cancel</button>
              </div>
              <div class="user-img" style="background-image: url('images/rooms/${b.type.toLowerCase()}.jpg'); background-size: cover;"></div>
          `;
          bookingsContainer.appendChild(card);
      });
  } catch (error) {
      console.error("Kunde inte hämta bokningar:", error);
  }
}
// Kör hämta bokningar om på user.html
if (window.location.pathname.includes('user.html')) {
  getUserBookings();
}

// Kör funktionen om vi är på admin-sidan
if(window.location.pathname.includes("admin.html")){
 loadAdminBookings();
}
// Ta bort en bokning från admin-sidan
async function adminCancelBooking(id){
 if(!confirm("Cancel this booking?")) return;
 await fetch(`${API_länk}/api/bookings/${id}`,{
  method:"DELETE",
  credentials:"include"
 });
 loadAdminBookings();
}
// Ladda alla rum i admin-sidan
async function loadAdminRooms(){
  const container = document.querySelector(".admin-rooms");
  if(!container) return;
  const response = await fetch(`${API_länk}/api/rooms`);
  const rooms = await response.json();
 
  container.innerHTML = "";
  rooms.forEach(room => {
  const card = document.createElement("div");
  card.innerHTML = `
  <div style="border:1px solid #555;padding:15px;margin:10px;">
  Room ${room.room_number} - ${room.status}
  <br>
  Type: ${room.type}
  <br>
  Price: ${room.price_per_night} kr
  <br><br>
  <button class="delete-btn" onclick="deleteRoom(${room.id})">
  Delete Room
  </button>
  </div>
  `;
  container.appendChild(card);
 });
}
// Ta bort ett rum från admin-sidan
async function deleteRoom(id){
 if(!confirm("Delete this room?")) return;
 await fetch(`${API_länk}/api/admin/rooms/${id}`,{
  method:"DELETE",
  credentials:"include"
 });
 loadAdminRooms();
}
// Lägg till ett nytt rum (admin)
async function addRoom(){
 const number = document.getElementById("room-number").value;
 const type = document.getElementById("room-type").value;
 const price = document.getElementById("room-price").value;
 const description = document.getElementById("room-description").value;

 if(!number || !type || !price){
  alert("Fill all fields");
  return;
 }

 await fetch(`${API_länk}/api/admin/rooms`,{
  method:"POST",
  headers:{
   "Content-Type":"application/json"
  },
  credentials:"include",
  body:JSON.stringify({
   room_number:number,
   type:type,
   price_per_night:price,
   description:description
  })
 });
}
function showAdminBookings(){
 document.getElementById("admin-bookings").style.display="block";
 document.getElementById("admin-rooms").style.display="none";
}
function showAdminRooms(){
 document.getElementById("admin-bookings").style.display="none";
 document.getElementById("admin-rooms").style.display="block";
 loadAdminRooms();
}
async function loadAdminBookings(){
 const res = await fetch(API_länk + "/api/admin/bookings",{
  credentials:"include"
 });
 const bookings = await res.json();
 const container = document.querySelector("#admin-bookings .admin-cards");
 container.innerHTML = "";
 bookings.forEach(b => {
  container.innerHTML += `
  <div class="admin-card">
   <h3>Room ${b.room_number}</h3>
   <p>User: ${b.username}</p>
   <p>${b.start_date} → ${b.end_date}</p>
  </div>
  `;
 });
 document.getElementById("total-bookings").innerText = bookings.length;
}
async function loadAdminStats(){
 const res = await fetch(API_länk + "/api/admin/stats",{credentials:"include"});
 const data = await res.json();
 document.getElementById("total-bookings").innerText = data.bookings;
 document.getElementById("available-rooms").innerText = data.rooms;
}
if(window.location.pathname.includes("admin.html")){
 loadAdminStats();
 loadAdminRooms();
}
