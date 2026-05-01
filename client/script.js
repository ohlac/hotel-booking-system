// Adress till api
const API_länk = "https://hotel-api-67w7.onrender.com";
// HTML-element
const roomsContainer = document.getElementById("rooms-container");
const loginForm = document.querySelector(".login-form");
// Kontrollera om användare är inloggad
async function checkLoginStatus() {
  try {
    const response = await fetch(`${API_länk}/api/check-auth`, {
      credentials: "include",
    });
    const data = await response.json();
    if (data.loggedIn) {
      updateNavForLoggedInUser(data.user.role);
      const welcomeText = document.querySelector("#user-welcome");
      if (welcomeText) {
        welcomeText.textContent = `Welcome back, ${data.user.username}!`;
      }
    }
    if (window.location.pathname.includes("user.html") && !data.loggedIn) {
      window.location.href = "login.html";
    }
    if (window.location.pathname.includes("admin.html")) {
      if (!data.loggedIn || data.user.role !== "admin") {
        window.location.href = "index.html";
      }
    }
  } catch (error) {
    console.error("Fel vid kontroll av login:", error);
  }
}
// Uppdatera navigation när inloggad
function updateNavForLoggedInUser(role) {
  const loginBtn = document.querySelector('a[href="login.html"]');
  if (loginBtn) {
    loginBtn.textContent = "Log Out";
    loginBtn.href = "#";
    loginBtn.addEventListener("click", logoutUser);
  }
  if (role === "admin") {
    const adminBtn = document.querySelector(".admin-hidden");
    if (adminBtn) {
      adminBtn.style.display = "block";
      adminBtn.classList.remove("admin-hidden");
    }
  }
}
// Logga ut användare
async function logoutUser(e) {
  e.preventDefault();
  try {
    await fetch(`${API_länk}/api/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout-fel:", error);
  }
}
checkLoginStatus();
// Login-formulär
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = loginForm.querySelector('input[type="text"]').value;
    const password = loginForm.querySelector('input[type="password"]').value;
    try {
      const response = await fetch(`${API_länk}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (result.loggedIn) {
        if (result.role === "admin") {
          window.location.href = "admin.html";
        } else {
          window.location.href = "user.html";
        }
      } else {
        alert("Login failed: " + result.message);
      }
    } catch (error) {
      console.error("Login-fel:", error);
    }
  });
}

// Glömt lösenord
const forgotPasswordForm = document.querySelector(".forgot-password-form");

if (forgotPasswordForm) {
  const forgotEmailInput = document.getElementById("forgot-email");
  const forgotMessage = document.getElementById("forgot-password-message");
  const forgotButton = forgotPasswordForm.querySelector(
    'button[type="submit"]',
  );

  function setForgotMessage(message, type = "") {
    forgotMessage.classList.remove("success", "error");
    if (type) forgotMessage.classList.add(type);
    forgotMessage.textContent = message;
  }

  forgotPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = forgotEmailInput.value.trim().toLowerCase();

    if (!email) {
      setForgotMessage("Please enter your email address.", "error");
      return;
    }

    try {
      forgotButton.disabled = true;
      forgotButton.textContent = "Sending...";

      const response = await fetch(`${API_länk}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      setForgotMessage(
        result.message ||
          "If an account exists with that email, a password reset link has been sent.",
        response.ok ? "success" : "error",
      );
    } catch (error) {
      console.error("Forgot password error:", error);
      setForgotMessage("Something went wrong. Please try again.", "error");
    } finally {
      forgotButton.disabled = false;
      forgotButton.textContent = "Send reset link";
    }
  });
}

// Återställ lösenord
const resetPasswordForm = document.querySelector(".reset-password-form");

if (resetPasswordForm) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const passwordInput = document.getElementById("reset-password");
  const confirmPasswordInput = document.getElementById(
    "reset-confirm-password",
  );
  const resetMessage = document.getElementById("reset-password-message");
  const resetButton = document.getElementById("reset-password-submit");

  function setResetMessage(message, type = "") {
    resetMessage.classList.remove("success", "error");
    if (type) resetMessage.classList.add(type);
    resetMessage.textContent = message;
  }

  function getPasswordError(password) {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(password))
      return "Password must include at least one uppercase letter.";
    if (!/[a-z]/.test(password))
      return "Password must include at least one lowercase letter.";
    if (!/\d/.test(password))
      return "Password must include at least one number.";
    return "";
  }

  async function verifyResetToken() {
    if (!token) {
      setResetMessage(
        "Reset token is missing. Please request a new reset link.",
        "error",
      );
      resetButton.disabled = true;
      return;
    }

    try {
      const response = await fetch(
        `${API_länk}/api/reset-password/${encodeURIComponent(token)}`,
      );
      const result = await response.json();

      if (!response.ok || !result.valid) {
        setResetMessage(
          result.message || "This reset link is invalid or has expired.",
          "error",
        );
        resetButton.disabled = true;
      }
    } catch (error) {
      console.error("Reset token verification error:", error);
      setResetMessage(
        "Could not verify reset link. Please try again.",
        "error",
      );
      resetButton.disabled = true;
    }
  }

  verifyResetToken();

  resetPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    const passwordError = getPasswordError(password);

    if (passwordError) {
      setResetMessage(passwordError, "error");
      return;
    }

    if (password !== confirmPassword) {
      setResetMessage("Passwords do not match.", "error");
      return;
    }

    try {
      resetButton.disabled = true;
      resetButton.textContent = "Updating...";

      const response = await fetch(`${API_länk}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setResetMessage(
          result.message || "Could not update password.",
          "error",
        );
        resetButton.disabled = false;
        resetButton.textContent = "Update password";
        return;
      }

      setResetMessage(
        "Password updated successfully. Redirecting to login...",
        "success",
      );

      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
    } catch (error) {
      console.error("Reset password error:", error);
      setResetMessage("Something went wrong. Please try again.", "error");
      resetButton.disabled = false;
      resetButton.textContent = "Update password";
    }
  });
}

// Registrering
const registerForm = document.querySelector(".register-form");

if (registerForm) {
  const emailInput = document.getElementById("reg-email");
  const usernameInput = document.getElementById("reg-username");
  const fullNameInput = document.getElementById("reg-fullname");
  const passwordInput = document.getElementById("reg-password");
  const confirmPasswordInput = document.getElementById("reg-confirm-password");
  const submitButton = document.getElementById("register-submit");
  const formMessage = document.getElementById("register-form-message");

  const emailMessage = document.getElementById("reg-email-message");
  const usernameMessage = document.getElementById("reg-username-message");
  const fullNameMessage = document.getElementById("reg-fullname-message");
  const passwordMessage = document.getElementById("reg-password-message");
  const confirmPasswordMessage = document.getElementById(
    "reg-confirm-password-message",
  );

  let checkUserTimeout = null;

  function setFieldState(input, messageElement, message, state) {
    input.classList.remove("input-error", "input-success");
    messageElement.classList.remove("error", "success");

    if (state === "error") {
      input.classList.add("input-error");
      messageElement.classList.add("error");
    }

    if (state === "success") {
      input.classList.add("input-success");
      messageElement.classList.add("success");
    }

    messageElement.textContent = message || "";
  }

  function setFormMessage(message, state) {
    formMessage.classList.remove("error", "success");

    if (state === "error") {
      formMessage.classList.add("error");
    }

    if (state === "success") {
      formMessage.classList.add("success");
    }

    formMessage.textContent = message || "";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
  }

  function getPasswordError(password) {
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (!/[A-Z]/.test(password)) {
      return "Password must include at least one uppercase letter.";
    }

    if (!/[a-z]/.test(password)) {
      return "Password must include at least one lowercase letter.";
    }

    if (!/\d/.test(password)) {
      return "Password must include at least one number.";
    }

    return "";
  }

  function validateLocalFields() {
    let isValid = true;

    const email = emailInput.value.trim().toLowerCase();
    const username = usernameInput.value.trim();
    const fullName = fullNameInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!email) {
      setFieldState(emailInput, emailMessage, "Email is required.", "error");
      isValid = false;
    } else if (!isValidEmail(email)) {
      setFieldState(
        emailInput,
        emailMessage,
        "Please enter a valid email address.",
        "error",
      );
      isValid = false;
    } else {
      setFieldState(
        emailInput,
        emailMessage,
        "Email format looks good.",
        "success",
      );
    }

    if (!username) {
      setFieldState(
        usernameInput,
        usernameMessage,
        "Username is required.",
        "error",
      );
      isValid = false;
    } else if (!isValidUsername(username)) {
      setFieldState(
        usernameInput,
        usernameMessage,
        "Username must be 3-20 characters and may only contain letters, numbers and underscores.",
        "error",
      );
      isValid = false;
    } else {
      setFieldState(
        usernameInput,
        usernameMessage,
        "Username format looks good.",
        "success",
      );
    }

    if (!fullName) {
      setFieldState(
        fullNameInput,
        fullNameMessage,
        "Full name is required.",
        "error",
      );
      isValid = false;
    } else if (fullName.length < 2) {
      setFieldState(
        fullNameInput,
        fullNameMessage,
        "Full name must be at least 2 characters.",
        "error",
      );
      isValid = false;
    } else {
      setFieldState(fullNameInput, fullNameMessage, "", "success");
    }

    const passwordError = getPasswordError(password);
    if (passwordError) {
      setFieldState(passwordInput, passwordMessage, passwordError, "error");
      isValid = false;
    } else {
      setFieldState(
        passwordInput,
        passwordMessage,
        "Password looks good.",
        "success",
      );
    }

    if (!confirmPassword) {
      setFieldState(
        confirmPasswordInput,
        confirmPasswordMessage,
        "Please repeat your password.",
        "error",
      );
      isValid = false;
    } else if (password !== confirmPassword) {
      setFieldState(
        confirmPasswordInput,
        confirmPasswordMessage,
        "Passwords do not match.",
        "error",
      );
      isValid = false;
    } else {
      setFieldState(
        confirmPasswordInput,
        confirmPasswordMessage,
        "Passwords match.",
        "success",
      );
    }

    return isValid;
  }

  async function checkUserAvailability() {
    const email = emailInput.value.trim().toLowerCase();
    const username = usernameInput.value.trim();

    if (!isValidEmail(email) && !isValidUsername(username)) {
      return;
    }

    try {
      const params = new URLSearchParams();

      if (isValidEmail(email)) {
        params.append("email", email);
      }

      if (isValidUsername(username)) {
        params.append("username", username);
      }

      const response = await fetch(
        `${API_lnk}/api/check-user?${params.toString()}`,
      );
      const result = await response.json();

      if (!response.ok) {
        return;
      }

      if (isValidEmail(email)) {
        if (result.emailExists) {
          setFieldState(
            emailInput,
            emailMessage,
            "An account with this email already exists.",
            "error",
          );
        } else {
          setFieldState(
            emailInput,
            emailMessage,
            "Email is available.",
            "success",
          );
        }
      }

      if (isValidUsername(username)) {
        if (result.usernameExists) {
          setFieldState(
            usernameInput,
            usernameMessage,
            "This username is already taken.",
            "error",
          );
        } else {
          setFieldState(
            usernameInput,
            usernameMessage,
            "Username is available.",
            "success",
          );
        }
      }
    } catch (error) {
      console.error("Could not check user availability:", error);
    }
  }

  function scheduleAvailabilityCheck() {
    clearTimeout(checkUserTimeout);

    checkUserTimeout = setTimeout(() => {
      checkUserAvailability();
    }, 450);
  }

  emailInput.addEventListener("input", () => {
    setFormMessage("", "");
    validateLocalFields();
    scheduleAvailabilityCheck();
  });

  usernameInput.addEventListener("input", () => {
    setFormMessage("", "");
    validateLocalFields();
    scheduleAvailabilityCheck();
  });

  fullNameInput.addEventListener("input", () => {
    setFormMessage("", "");
    validateLocalFields();
  });

  passwordInput.addEventListener("input", () => {
    setFormMessage("", "");
    validateLocalFields();
  });

  confirmPasswordInput.addEventListener("input", () => {
    setFormMessage("", "");
    validateLocalFields();
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    setFormMessage("", "");

    const localValid = validateLocalFields();

    if (!localValid) {
      setFormMessage(
        "Please fix the highlighted fields before registering.",
        "error",
      );
      return;
    }

    if (
      emailInput.classList.contains("input-error") ||
      usernameInput.classList.contains("input-error")
    ) {
      setFormMessage(
        "Please fix the highlighted fields before registering.",
        "error",
      );
      return;
    }

    const email = emailInput.value.trim().toLowerCase();
    const username = usernameInput.value.trim();
    const fullName = fullNameInput.value.trim();
    const password = passwordInput.value;

    try {
      submitButton.disabled = true;
      submitButton.textContent = "Registering...";

      const response = await fetch(`${API_lnk}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, fullName, password }),
      });

      const result = await response.json();

      if (response.ok) {
        setFormMessage(
          "Registration successful! Redirecting to login...",
          "success",
        );

        setTimeout(() => {
          window.location.href = "login.html";
        }, 900);

        return;
      }

      if (result.field === "email") {
        setFieldState(emailInput, emailMessage, result.message, "error");
      }

      if (result.field === "username") {
        setFieldState(usernameInput, usernameMessage, result.message, "error");
      }

      setFormMessage(result.message || "Registration failed.", "error");
    } catch (error) {
      console.error("Registration error:", error);
      setFormMessage(
        "An error occurred during registration. Please try again.",
        "error",
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Register";
    }
  });
}

// ==========================================
// SÖK, BOKA OCH VISA RUM
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("search-form");
  const roomsContainer = document.getElementById("rooms-container");
  const startDateInput = document.getElementById("search-start");
  const endDateInput = document.getElementById("search-end");

  if (startDateInput && endDateInput) {
    const today = new Date().toISOString().slice(0, 10);

    startDateInput.min = today;
    endDateInput.min = today;

    startDateInput.addEventListener("change", () => {
      endDateInput.min = startDateInput.value || today;

      if (endDateInput.value && endDateInput.value <= startDateInput.value) {
        endDateInput.value = "";
      }
    });
  }

  const savedSearch = JSON.parse(
    localStorage.getItem("lastRoomSearch") || "null",
  );

  if (searchForm) {
    if (savedSearch && savedSearch.start && savedSearch.end) {
      document.getElementById("search-start").value = savedSearch.start;
      document.getElementById("search-end").value = savedSearch.end;
      document.getElementById("search-type").value = savedSearch.type || "Any";
      getRooms(savedSearch.start, savedSearch.end, savedSearch.type || "Any");
    } else if (roomsContainer) {
      getRooms();
    }

    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const start = document.getElementById("search-start").value;
      const end = document.getElementById("search-end").value;
      const type = document.getElementById("search-type").value;

      const today = new Date().toISOString().slice(0, 10);

      if (start < today) {
        alert("Check-in date cannot be in the past.");
        return;
      }

      if (end <= start) {
        alert("Check-out date must be after check-in date!");
        return;
      }

      localStorage.setItem(
        "lastRoomSearch",
        JSON.stringify({
          start,
          end,
          type,
        }),
      );

      getRooms(start, end, type);
    });
  } else if (roomsContainer) {
    getRooms();
  }

  if (document.getElementById("bookings-list")) {
    getUserBookings();
  }

  if (window.location.pathname.includes("booking.html")) {
    confirmStripeBooking();
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("payment") === "cancelled") {
    alert("Payment was cancelled. No booking was created.");
  }
});

let currentRoomDetails = null;
let currentRoomImages = [];
let currentRoomImageIndex = 0;

function getRoomImages(room) {
  const roomId = Number(room.id);

  const imageSets = {
    Single: ['1.jpg', '2.jpg', '3.jpg'],
    Double: ['4.jpg', '5.jpg', '6.jpg'],
    Suite: ['7.jpg', '8.jpg', '9.jpg']
  };

  const fallback = imageSets[room.type] || ['1.jpg', '2.jpg', '3.jpg'];

  // Gör att olika rum av samma typ får lite olika första bild
  const offset = roomId % fallback.length;
  return [...fallback.slice(offset), ...fallback.slice(0, offset)].map(file => `images/${file}`);
}

function getRoomPreviewImage(room) {
  return getRoomImages(room)[0];
}

async function getRooms(start = '', end = '', type = '') {
  const roomsContainer = document.getElementById('rooms-container');
  if (!roomsContainer) return;

  try {
    let url = `${API_länk}/api/rooms`;
    if (start && end) {
      url += `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&type=${encodeURIComponent(type)}`;
    }

    const response = await fetch(url);
    const rooms = await response.json();

    roomsContainer.innerHTML = '';

    if (!Array.isArray(rooms) || rooms.length === 0) {
      roomsContainer.innerHTML = `<p style="text-align:center; width:100%;">No available rooms found for these dates.</p>`;
      return;
    }

    rooms.forEach(room => {
      const previewImage = getRoomPreviewImage(room);

      const roomCard = document.createElement('article');
      roomCard.classList.add('room-card', 'clickable-room-card');

      roomCard.innerHTML = `
        <div class="room-text">
          <h3 class="room-title">Room ${room.room_number} - ${room.type}</h3>
          <p class="room-desc">${room.description || 'No description available.'}</p>
          <p class="room-desc" style="font-weight: bold; color: #d4af37;">
            Price: ${room.price_per_night} kr/night
          </p>
          <button class="search-btn" type="button" onclick="event.stopPropagation(); bookRoom(${room.id})">
            Book Room
          </button>
        </div>

        <div class="room-image-container">
          <img src="${previewImage}" alt="${room.type} room" class="room-image">
        </div>
      `;

      roomCard.addEventListener('click', () => {
        openRoomDetails(room);
      });

      roomsContainer.appendChild(roomCard);
    });
  } catch (error) {
    console.error('Fel vid hämtning av rum:', error);
    roomsContainer.innerHTML = `<p style="text-align:center; color:red;">Kunde inte hämta rum.</p>`;
  }
}

function openRoomDetails(room) {
  currentRoomDetails = room;
  currentRoomImages = getRoomImages(room);
  currentRoomImageIndex = 0;

  const modal = document.getElementById('room-details-modal');
  const image = document.getElementById('room-modal-image');
  const title = document.getElementById('room-modal-title');
  const description = document.getElementById('room-modal-description');
  const price = document.getElementById('room-modal-price');
  const status = document.getElementById('room-modal-status');
  const bookBtn = document.getElementById('room-modal-book-btn');

  if (!modal || !image || !title || !description || !price || !status || !bookBtn) return;

  image.src = currentRoomImages[currentRoomImageIndex];
  image.alt = `${room.type} room ${room.room_number}`;

  title.textContent = `Room ${room.room_number} - ${room.type}`;
  description.textContent = room.description || 'No description available.';
  price.textContent = `${room.price_per_night} kr per night`;
  status.textContent = room.status ? `Status: ${room.status}` : '';

  bookBtn.onclick = () => {
    closeRoomDetails();
    bookRoom(room.id);
  };

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

window.closeRoomDetails = function () {
  const modal = document.getElementById('room-details-modal');
  if (!modal) return;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
};

window.changeRoomImage = function (direction) {
  const image = document.getElementById('room-modal-image');
  if (!image || currentRoomImages.length === 0) return;

  currentRoomImageIndex += direction;

  if (currentRoomImageIndex < 0) {
    currentRoomImageIndex = currentRoomImages.length - 1;
  }

  if (currentRoomImageIndex >= currentRoomImages.length) {
    currentRoomImageIndex = 0;
  }

  image.src = currentRoomImages[currentRoomImageIndex];
};

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeRoomDetails();
  }
});

window.bookRoom = async function (roomId) {
  const startInput = document.getElementById("search-start");
  const endInput = document.getElementById("search-end");
  const typeInput = document.getElementById("search-type");

  if (!startInput || !endInput || !startInput.value || !endInput.value) {
    alert(
      "Please search for available dates in the panel above before booking a room!",
    );
    return;
  }

  const startDate = startInput.value;
  const endDate = endInput.value;
  const type = typeInput ? typeInput.value : "Any";

  const today = new Date().toISOString().slice(0, 10);

  if (startDate < today) {
    alert("Check-in date cannot be in the past.");
    return;
  }

  if (endDate <= startDate) {
    alert("Check-out date must be after check-in date.");
    return;
  }

  localStorage.setItem(
    "lastRoomSearch",
    JSON.stringify({
      start: startDate,
      end: endDate,
      type: type,
    }),
  );

  try {
    const response = await fetch(`${API_länk}/api/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ roomId, startDate, endDate }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Could not start payment.");
      if (response.status === 401) {
        window.location.href = "login.html";
      }
      return;
    }

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Could not load payment page.");
    }
  } catch (error) {
    console.error("Booking/payment error:", error);
    alert("Something went wrong while starting payment.");
  }
};

async function confirmStripeBooking() {
  const title = document.getElementById("payment-title");
  const message = document.getElementById("booking-message");
  const dates = document.getElementById("booking-dates");
  const bookingIdText = document.getElementById("booking-id-text");

  if (!title || !message || !dates || !bookingIdText) return;

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  if (!sessionId) {
    title.textContent = "Missing payment session";
    message.textContent = "No Stripe session ID was found in the URL.";
    dates.textContent = "";
    bookingIdText.textContent = "";
    return;
  }

  try {
    const response = await fetch(
      `${API_länk}/api/confirm-booking?session_id=${encodeURIComponent(sessionId)}`,
      { credentials: "include" },
    );

    const data = await response.json();

    if (!response.ok) {
      title.textContent =
        "Payment received, but booking could not be confirmed";
      message.textContent =
        data.message || "Something went wrong while confirming your booking.";
      dates.textContent = "";
      bookingIdText.textContent = "";
      return;
    }

    const formattedStart = new Date(data.startDate).toLocaleDateString();
    const formattedEnd = new Date(data.endDate).toLocaleDateString();

    title.textContent = "Payment successful ✓";
    message.textContent = "Your booking has been confirmed and saved.";
    dates.innerHTML = `Room <strong>${data.roomNumber}</strong> (${data.roomType}) from <strong>${formattedStart}</strong> to <strong>${formattedEnd}</strong>.`;
    bookingIdText.innerHTML = `Booking ID: <strong>#${data.bookingId}</strong>`;
  } catch (error) {
    console.error("Error confirming Stripe booking:", error);
    title.textContent = "Could not confirm booking";
    message.textContent =
      "A server error occurred while confirming your booking.";
    dates.textContent = "";
    bookingIdText.textContent = "";
  }
}

window.cancelBooking = async function (bookingId) {
  if (!confirm("Are you sure you want to cancel this booking?")) return;
  try {
    const response = await fetch(`${API_länk}/api/bookings/${bookingId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      getUserBookings(); // Ladda om listan direkt efter avbokning
    } else {
      alert("Kunde inte avboka.");
    }
  } catch (error) {
    console.error(error);
  }
};
// Bildslider på hotel-info.html
const sliderImg = document.querySelector(".slider-img");
if (sliderImg) {
  const images = [
    "images/hotel/1.jpg",
    "images/hotel/2.jpg",
    "images/hotel/3.jpg",
    "images/hotel/4.jpg",
    "images/hotel/5.jpg",
    "images/hotel/6.jpg",
    "images/hotel/7.jpg",
  ];
  let currentImageIndex = 0;
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  function showImage() {
    sliderImg.style.backgroundImage = `url(${images[currentImageIndex]})`;
  }
  // Klicka på vänsterpil
  prevBtn.addEventListener("click", () => {
    currentImageIndex--;
    if (currentImageIndex < 0) currentImageIndex = images.length - 1;
    showImage();
  });
  //Klicka på högerpil
  nextBtn.addEventListener("click", () => {
    currentImageIndex++;
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
    hotelDesc1:
      "Experience comfort and elegance at Hotel California, a welcoming retreat in the heart of Trollhättan.",
    hotelDesc2:
      "Our thoughtfully designed rooms combine modern comfort with a warm atmosphere, creating the perfect place to relax after a long day.",
    hotelDesc3:
      "Guests enjoy complimentary breakfast each morning along with attentive service throughout their stay.",
    hotelDesc4:
      "Whether you're here for a romantic getaway or a family vacation, Hotel California has something for everyone.",
    hotelDesc5:
      "If you have any questions, please don't hesitate to contact us!",
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
    loginInfoText:
      "Log in to manage your room bookings and adjust user settings",
    username: "Username",
    password: "Password",
    registerLink: "Not a user yet? Register Here",
    // REGISTER
    registerInfo:
      "Register to manage your room bookings and adjust user settings",
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
    copyright: "Copyright",
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
    hotelDesc1:
      "Upplev komfort och elegans på Hotel California, en välkomnande oas i hjärtat av Trollhättan.",
    hotelDesc2:
      "Våra genomtänkta rum kombinerar modern komfort med en varm atmosfär, perfekt för avkoppling efter en lång dag.",
    hotelDesc3:
      "Gästerna njuter av kostnadsfri frukost varje morgon samt personlig service under hela vistelsen.",
    hotelDesc4:
      "Oavsett om du är här för en romantisk resa eller familjesemester har Hotel California något för alla.",
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
    copyright: "Copyright",
  },
};


function setLanguage(lang) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
  localStorage.setItem("lang", lang);
  const btn = document.getElementById("langBtn");
  if (btn) {
    btn.textContent = lang.toUpperCase();
  }
}
document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("lang") || "en";
  setLanguage(savedLang);
  const btn = document.getElementById("langBtn");
  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const current = localStorage.getItem("lang") || "en";
      const next = current === "en" ? "sv" : "en";
      setLanguage(next);
    });
  }
});


// Visa användarinställningar
function setUserTab(activeTab) {
  const bookingsTab = document.getElementById("user-bookings-tab");
  const settingsTab = document.getElementById("user-settings-tab");

  if (bookingsTab) bookingsTab.classList.toggle("active", activeTab === "bookings");
  if (settingsTab) settingsTab.classList.toggle("active", activeTab === "settings");
}

function showSettings(event) {
  if (event) event.preventDefault();

  document.getElementById("bookings-section").style.display = "none";
  document.getElementById("user-settings").style.display = "block";

  setUserTab("settings");
  loadUserProfile();
}

function showBookings(event) {
  if (event) event.preventDefault();

  document.getElementById("bookings-section").style.display = "block";
  document.getElementById("user-settings").style.display = "none";

  setUserTab("bookings");
}


// Save user settingss
async function loadUserProfile() {
  const emailInput = document.getElementById("user-email");
  if (!emailInput) return;

  try {
    const response = await fetch(`${API_länk}/api/user/profile`, {
      credentials: "include"
    });

    if (!response.ok) return;

    const user = await response.json();
    emailInput.value = user.email || "";
  } catch (error) {
    console.error("Could not load user profile:", error);
  }
}

function setSettingsMessage(message, type = "") {
  const messageEl = document.getElementById("settings-message");
  if (!messageEl) return;

  messageEl.classList.remove("success", "error");
  if (type) messageEl.classList.add(type);
  messageEl.textContent = message;
}

const saveBtn = document.getElementById("save-user-settings");

if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const email = document.getElementById("user-email").value.trim().toLowerCase();
    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmNewPassword = document.getElementById("confirm-new-password").value;

    setSettingsMessage("", "");

    if (!email) {
      setSettingsMessage("Email is required.", "error");
      return;
    }

    if (newPassword || confirmNewPassword) {
      if (newPassword !== confirmNewPassword) {
        setSettingsMessage("New passwords do not match.", "error");
        return;
      }

      if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
        setSettingsMessage("New password must be at least 8 characters and include uppercase, lowercase and a number.", "error");
        return;
      }
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      const response = await fetch(`${API_länk}/api/update-user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          currentPassword,
          newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setSettingsMessage(result.message || "Could not update settings.", "error");
        return;
      }

      document.getElementById("current-password").value = "";
      document.getElementById("new-password").value = "";
      document.getElementById("confirm-new-password").value = "";

      setSettingsMessage(result.message || "Settings updated successfully.", "success");
    } catch (error) {
      console.error(error);
      setSettingsMessage("Something went wrong. Please try again.", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    }
  });
}


async function getUserBookings() {
  const bookingsContainer = document.querySelector("#bookings-section");
  if (!bookingsContainer) return;
  try {
    const response = await fetch(`${API_länk}/api/user/bookings`, {
      credentials: "include",
    });
    const bookings = await response.json();
    // rensa gamla bokningskort
    const welcomeHtml =
      bookingsContainer.querySelector(".user-welcome").outerHTML;
    const titleHtml = bookingsContainer.querySelector(".user-title").outerHTML;
    bookingsContainer.innerHTML = welcomeHtml + titleHtml;
    if (bookings.length === 0) {
      bookingsContainer.innerHTML += "<p>Du har inga aktiva bokningar.</p>";
      return;
    }
    bookings.forEach((b) => {
      const card = document.createElement("article");
      card.classList.add("user-booking-card");

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
if (window.location.pathname.includes("user.html")) {
  getUserBookings();
}

// Kör funktionen om vi är på admin-sidan
if (window.location.pathname.includes("admin.html")) {
  loadAdminBookings();
}

// Ta bort en bokning från admin-sidan
async function adminCancelBooking(id) {
  if (!confirm("Cancel this booking?")) return;

  try {
    const response = await fetch(`${API_länk}/api/admin/bookings/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const contentType = response.headers.get("content-type") || "";
    let data = {};

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: text || "Could not cancel booking." };
    }

    if (!response.ok) {
      alert(data.message || "Could not cancel booking.");
      return;
    }

    alert("Booking cancelled.");
    loadAdminBookings();
    loadAdminRooms();
    loadAdminStats();
  } catch (error) {
    console.error("Admin cancel booking error:", error);
    alert("Something went wrong while cancelling the booking.");
  }
}

// Ladda alla rum i admin-sidan
async function loadAdminRooms() {
  const container = document.querySelector(".admin-rooms");
  if (!container) return;

  try {
    const response = await fetch(`${API_länk}/api/admin/rooms-with-bookings`, {
      credentials: "include"
    });

    const rooms = await response.json();

    if (!response.ok) {
      container.innerHTML = `<p style="color:red;">${rooms.message || "Could not load rooms."}</p>`;
      return;
    }

    container.innerHTML = "";

    rooms.forEach(room => {
      const card = document.createElement("div");
      card.classList.add("admin-room-card");

      const bookingsHtml = room.bookings.length === 0
        ? `<p class="admin-empty-bookings">No bookings for this room.</p>`
        : room.bookings.map(booking => {
            const start = new Date(booking.start_date).toLocaleDateString();
            const end = new Date(booking.end_date).toLocaleDateString();

            return `
              <div class="admin-room-booking">
                <div>
                  <strong>${start} → ${end}</strong><br>
                  Guest: ${booking.full_name || booking.username}<br>
                  Email: ${booking.email}
                </div>
                <button class="cancel-btn" onclick="adminCancelBooking(${booking.booking_id})">
                  Cancel this booking
                </button>
              </div>
            `;
          }).join("");

      card.innerHTML = `
        <div class="admin-room-header">
          <div>
            <h3>Room ${room.room_number} - ${room.type}</h3>
            <p>${room.description || "No description available."}</p>
            <p><strong>${room.price_per_night} kr/night</strong></p>
          </div>

          <button class="delete-btn" onclick="deleteRoom(${room.id})">
            Delete Room
          </button>
        </div>

        <div class="admin-room-bookings">
          <h4>Bookings for this room</h4>
          ${bookingsHtml}
        </div>
      `;

      container.appendChild(card);
    });
  } catch (error) {
    console.error("Could not load rooms:", error);
    container.innerHTML = `<p style="color:red;">Could not load rooms.</p>`;
  }
}


// Ta bort ett rum från admin-sidan
async function deleteRoom(id) {
  if (!confirm("Delete this room?")) return;
  await fetch(`${API_länk}/api/admin/rooms/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  loadAdminRooms();
}


// Lägg till ett nytt rum (admin)
async function addRoom() {
  const number = document.getElementById("room-number").value.trim();
  const type = document.getElementById("room-type").value;
  const price = document.getElementById("room-price").value;
  const description = document.getElementById("room-description").value.trim();
  const message = document.getElementById("add-room-message");

  function setMessage(text, status) {
    if (!message) return;
    message.classList.remove("success", "error");
    if (status) message.classList.add(status);
    message.textContent = text;
  }

  if (!number || !type || !price || !description) {
    setMessage("Please fill in all fields.", "error");
    return;
  }

  if (Number(price) <= 0) {
    setMessage("Price must be greater than 0.", "error");
    return;
  }

  try {
    setMessage("Adding room...", "");

    const response = await fetch(`${API_länk}/api/admin/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        room_number: number,
        type,
        price_per_night: price,
        description
      })
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message || "Could not add room.", "error");
      return;
    }

    document.getElementById("room-number").value = "";
    document.getElementById("room-type").value = "";
    document.getElementById("room-price").value = "";
    document.getElementById("room-description").value = "";

    setMessage(result.message || "Room added successfully.", "success");

    loadAdminRooms();
    loadAdminStats();
  } catch (error) {
    console.error("Could not add room:", error);
    setMessage("Something went wrong while adding the room.", "error");
  }
}


function setAdminTab(activeTab) {
  const bookingsTab = document.getElementById("admin-bookings-tab");
  const roomsTab = document.getElementById("admin-rooms-tab");

  if (bookingsTab) bookingsTab.classList.toggle("active", activeTab === "bookings");
  if (roomsTab) roomsTab.classList.toggle("active", activeTab === "rooms");
}

function showAdminBookings(event) {
  if (event) event.preventDefault();

  document.getElementById("admin-bookings").style.display = "block";
  document.getElementById("admin-rooms").style.display = "none";

  setAdminTab("bookings");
  loadAdminBookings();
  loadAdminStats();
}

function showAdminRooms(event) {
  if (event) event.preventDefault();

  document.getElementById("admin-bookings").style.display = "none";
  document.getElementById("admin-rooms").style.display = "block";

  setAdminTab("rooms");
  loadAdminRooms();
  loadAdminStats();
}

async function loadAdminBookings() {
  try {
    const res = await fetch(`${API_länk}/api/admin/bookings`, {
      credentials: "include",
    });

    const contentType = res.headers.get("content-type") || "";
    let bookings = [];

    if (contentType.includes("application/json")) {
      bookings = await res.json();
    } else {
      const text = await res.text();
      throw new Error(text || "Could not load admin bookings.");
    }

    const container = document.querySelector("#admin-bookings .admin-cards");
    if (!container) return;

    container.innerHTML = "";

    if (!Array.isArray(bookings) || bookings.length === 0) {
      container.innerHTML = `<p>No current bookings found.</p>`;
      document.getElementById("total-bookings").innerText = 0;
      return;
    }

    bookings.forEach((b) => {
      const start = new Date(b.start_date).toLocaleDateString();
      const end = new Date(b.end_date).toLocaleDateString();

      container.innerHTML += `
        <div class="admin-card">
          <h3>Room ${b.room_number}</h3>
          <p>User: ${b.username}</p>
          <p>Type: ${b.type}</p>
          <p>${start} → ${end}</p>
          <button class="cancel-btn" onclick="adminCancelBooking(${b.id})">
            Cancel Booking
          </button>
        </div>
      `;
    });

    document.getElementById("total-bookings").innerText = bookings.length;
  } catch (error) {
    console.error("Could not load admin bookings:", error);
    const container = document.querySelector("#admin-bookings .admin-cards");
    if (container) {
      container.innerHTML = `<p style="color:red;">Could not load admin bookings.</p>`;
    }
  }
}

async function loadAdminStats() {
  const res = await fetch(API_länk + "/api/admin/stats", {
    credentials: "include"
  });

  const data = await res.json();

  document.getElementById("total-bookings").innerText = data.bookings;
  document.getElementById("available-rooms").innerText = data.availableToday;
}


if (window.location.pathname.includes("admin.html")) {
  loadAdminStats();
  loadAdminRooms();
}
