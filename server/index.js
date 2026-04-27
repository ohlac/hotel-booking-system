require('dotenv').config(); // inställningarna från .env
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const session = require('express-session');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const {
    sendRegistrationEmail,
    sendBookingConfirmedEmail,
    sendBookingCancelledEmail,
    sendUserUpdatedEmail,
    sendPasswordResetEmail
} = require('./email');


app.set('trust proxy', 1);

// frontend prata med backend
app.use(cors({
    origin: [
    'https://hotel-frontend-vi9g.onrender.com',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
    ],
    methods: ["GET","POST","PUT","DELETE"],
    credentials: true,
    exposedHeaders: ['set-cookie']
}));

app.use(express.json()); // för att kunna läsa JSON-data

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

app.use(session({
    name: 'hotel_session', // namnet på cookie som lagrar sessionen
    secret: process.env.SESSION_SECRET ||'dev-only-secret', // lösenord för sessionen.
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { 
        secure: isProduction ? true : false, // Endast över HTTPS i produktion
        sameSite: isProduction ? 'none' : 'lax', // 'none' i produktion för att tillåta cross-site cookies
        httpOnly: true,
        maxAge: 1000 * 60 * 60 // Sista siffran är minuter som användaren är inloggad. 60 min nu.
    }
}));

// kopplingen till Aiven-databasen
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


function hashResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function isStrongPassword(password) {
    return (
        typeof password === 'string' &&
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /\d/.test(password)
    );
}

async function passwordMatches(inputPassword, storedPassword) {
    if (!storedPassword) return false;

    // Std fr nya hashade lsenord
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
        return bcrypt.compare(inputPassword, storedPassword);
    }

    // Std fr dina gamla lsenord i klartext s att befintliga konton inte gr snder direkt
    return inputPassword === storedPassword;
}


// Test för att se att servern fungerar
app.get('/', (req, res) => {
    res.send('Hotel-API is running');
});

// ===============================================
// RUTTER (ENDPOINTS)
// ===============================================

// Hämta rum (och filtrera bort bokade om man har valt datum)
app.get('/api/rooms', async (req, res) => {
    const { start, end, type } = req.query;
    try {
        let sql = `
        SELECT r.*, 
        CASE 
        WHEN EXISTS (
        SELECT 1 FROM bookings b 
        WHERE b.room_id = r.id
        ) THEN 'Booked'
         ELSE 'Available'
         END AS status
         FROM rooms r`;

        const params = [];

        if (start && end) {
            sql += ` WHERE id NOT IN (
                SELECT room_id FROM bookings 
                WHERE start_date < ? AND end_date > ?
            )`;
            params.push(end, start); 
        }

        if (type && type !== 'Any') {
            if (params.length > 0) {
                sql += " AND type = ?";
            } else {
                sql += " WHERE type = ?";
            }
            params.push(type);
        }

        const [rows] = await pool.promise().query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Fel vid hämtning av rum:', error);
        res.status(500).json({ error: 'Kunde inte hämta rum' });
    }
});

// Skapa ny bokning
app.post('/api/create-checkout-session', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "You need to log in first." });
    }

    const { roomId, startDate, endDate } = req.body;

    if (!roomId || !startDate || !endDate) {
        return res.status(400).json({ message: "roomId, startDate and endDate are required." });
    }

    if (startDate >= endDate) {
        return res.status(400).json({ message: "End date must be after start date." });
    }

    try {
        const [roomRows] = await pool.promise().query(
            `SELECT id, room_number, type, price_per_night
             FROM rooms
             WHERE id = ?
             LIMIT 1`,
            [roomId]
        );

        if (roomRows.length === 0) {
            return res.status(404).json({ message: "Room not found." });
        }

        const room = roomRows[0];

        const [conflicts] = await pool.promise().query(
            `SELECT id
             FROM bookings
             WHERE room_id = ?
               AND start_date < ?
               AND end_date > ?
             LIMIT 1`,
            [roomId, endDate, startDate]
        );

        if (conflicts.length > 0) {
            return res.status(409).json({ message: "This room is no longer available for those dates." });
        }

        const millisecondsPerDay = 1000 * 60 * 60 * 24;
        const nights = Math.round((new Date(endDate) - new Date(startDate)) / millisecondsPerDay);

        if (nights <= 0) {
            return res.status(400).json({ message: "Invalid number of nights." });
        }

        const totalAmount = Math.round(Number(room.price_per_night) * nights * 100);
        const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';

        const checkoutSession = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'sek',
                        product_data: {
                            name: `Room ${room.room_number} - ${room.type}`,
                            description: `${startDate} to ${endDate} (${nights} night${nights > 1 ? 's' : ''})`
                        },
                        unit_amount: totalAmount
                    },
                    quantity: 1
                }
            ],
            success_url: `${frontendUrl}/booking.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/index.html?payment=cancelled`,
            metadata: {
                userId: String(req.session.user.id),
                roomId: String(room.id),
                roomNumber: String(room.room_number),
                roomType: room.type,
                startDate,
                endDate
            }
        });

        res.json({ url: checkoutSession.url });
    } catch (error) {
        console.error("Error creating Stripe Checkout Session:", error);
        res.status(500).json({ message: "Could not create payment session." });
    }
});

app.get('/api/confirm-booking', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "You need to log in first." });
    }

    const { session_id } = req.query;

    if (!session_id) {
        return res.status(400).json({ message: "Missing session_id." });
    }

    try {
        const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);

        if (!checkoutSession || checkoutSession.payment_status !== 'paid') {
            return res.status(400).json({ message: "Payment is not completed." });
        }

        if (!checkoutSession.metadata || checkoutSession.metadata.userId !== String(req.session.user.id)) {
            return res.status(403).json({ message: "This payment does not belong to the logged-in user." });
        }

        const { roomId, roomNumber, roomType, startDate, endDate } = checkoutSession.metadata;

        const [existingBooking] = await pool.promise().query(
            `SELECT id
             FROM bookings
             WHERE user_id = ?
               AND room_id = ?
               AND start_date = ?
               AND end_date = ?
             LIMIT 1`,
            [req.session.user.id, roomId, startDate, endDate]
        );

        if (existingBooking.length > 0) {
            return res.json({
                message: "Booking already confirmed.",
                bookingId: existingBooking[0].id,
                roomNumber,
                roomType,
                startDate,
                endDate
            });
        }

        const [conflicts] = await pool.promise().query(
            `SELECT id
             FROM bookings
             WHERE room_id = ?
               AND start_date < ?
               AND end_date > ?
             LIMIT 1`,
            [roomId, endDate, startDate]
        );

        if (conflicts.length > 0) {
            return res.status(409).json({
                message: "Payment succeeded, but the room was booked before confirmation. For a real project, solve this with webhooks and a reservation-hold system."
            });
        }

        const [result] = await pool.promise().query(
            `INSERT INTO bookings (user_id, room_id, start_date, end_date)
             VALUES (?, ?, ?, ?)`,
            [req.session.user.id, roomId, startDate, endDate]
        );
        
        const [userRows] = await pool.promise().query(
            `SELECT email, full_name
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [req.session.user.id]
        );
        
        if (userRows.length > 0) {
            await sendBookingConfirmedEmail({
                to: userRows[0].email,
                fullName: userRows[0].full_name,
                bookingId: result.insertId,
                roomNumber,
                roomType,
                startDate,
                endDate
            });
        }
        
        res.json({
            message: "Booking confirmed successfully.",
            bookingId: result.insertId,
            roomNumber,
            roomType,
            startDate,
            endDate
        });
    } catch (error) {
        console.error("Error confirming booking after payment:", error);
        res.status(500).json({ message: "Could not confirm booking." });
    }
});

// Hämta inloggad användares bokningar
// Hämta inloggad användares bokningar
app.get('/api/user/bookings', async (req, res) => {

 if (!req.session.user) {
  return res.status(401).json({ message: "Not logged in" });
 }

 const userId = req.session.user.id;

 try {

  const sql = `
  SELECT b.id as booking_id, b.start_date, b.end_date, r.room_number, r.type, r.price_per_night
  FROM bookings b
  JOIN rooms r ON b.room_id = r.id
  WHERE b.user_id = ?
  `;

  const [rows] = await pool.promise().query(sql, [userId]);

  res.json(rows);

 } catch (error) {

  console.error("Fel vid hämtning av användarens bokningar:", error);
  res.status(500).json({ message: "Could not fetch bookings" });

 }

});



// Avboka ett rum (Ta bort bokning)
app.delete('/api/bookings/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Not logged in" });
    }

    try {
        const bookingId = req.params.id;
        const userId = req.session.user.id;

        const [bookingRows] = await pool.promise().query(
            `SELECT 
                b.id AS booking_id,
                b.start_date,
                b.end_date,
                r.room_number,
                r.type,
                u.email,
                u.full_name
             FROM bookings b
             JOIN rooms r ON b.room_id = r.id
             JOIN users u ON b.user_id = u.id
             WHERE b.id = ? AND b.user_id = ?
             LIMIT 1`,
            [bookingId, userId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({ message: "Booking not found" });
        }

        const booking = bookingRows[0];

        const [deleteResult] = await pool.promise().query(
            'DELETE FROM bookings WHERE id = ? AND user_id = ?',
            [bookingId, userId]
        );

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: "Booking not found" });
        }

        await sendBookingCancelledEmail({
            to: booking.email,
            fullName: booking.full_name,
            bookingId: booking.booking_id,
            roomNumber: booking.room_number,
            roomType: booking.type,
            startDate: booking.start_date,
            endDate: booking.end_date
        });

        res.json({ message: "Booking cancelled" });
    } catch (error) {
        console.error("Could not cancel booking:", error);
        res.status(500).json({ message: "Could not cancel booking" });
    }
});

// Avboka en bokning (endast admin)
app.delete('/api/admin/bookings/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin only" });
    }

    try {
        const bookingId = req.params.id;

        const [bookingRows] = await pool.promise().query(
            `SELECT 
                b.id AS booking_id,
                b.start_date,
                b.end_date,
                r.room_number,
                r.type,
                u.email,
                u.full_name
             FROM bookings b
             JOIN rooms r ON b.room_id = r.id
             JOIN users u ON b.user_id = u.id
             WHERE b.id = ?
             LIMIT 1`,
            [bookingId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({ message: "Booking not found" });
        }

        const booking = bookingRows[0];

        const [deleteResult] = await pool.promise().query(
            'DELETE FROM bookings WHERE id = ?',
            [bookingId]
        );

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: "Booking not found" });
        }

        await sendBookingCancelledEmail({
            to: booking.email,
            fullName: booking.full_name,
            bookingId: booking.booking_id,
            roomNumber: booking.room_number,
            roomType: booking.type,
            startDate: booking.start_date,
            endDate: booking.end_date
        });

        res.json({ message: "Booking cancelled by admin" });
    } catch (error) {
        console.error("Could not cancel booking by admin:", error);
        res.status(500).json({ message: "Could not cancel booking" });
    }
});

// Kontrollera om e-post eller anvndarnamn redan finns
app.get('/api/check-user', async (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    const username = String(req.query.username || '').trim();

    try {
        const result = {
            emailExists: false,
            usernameExists: false
        };

        if (email) {
            const [emailRows] = await pool.promise().query(
                'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1',
                [email]
            );
            result.emailExists = emailRows.length > 0;
        }

        if (username) {
            const [usernameRows] = await pool.promise().query(
                'SELECT id FROM users WHERE username = ? LIMIT 1',
                [username]
            );
            result.usernameExists = usernameRows.length > 0;
        }

        res.json(result);
    } catch (error) {
        console.error('Could not check user:', error);
        res.status(500).json({ message: 'Could not check user' });
    }
});

// Registrera
app.post('/api/register', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const username = String(req.body.username || '').trim();
    const fullName = String(req.body.fullName || '').trim();
    const password = String(req.body.password || '');

    try {
        if (!email || !username || !fullName || !password) {
            return res.status(400).json({
                message: 'All fields are required.'
            });
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            return res.status(400).json({
                message: 'Please enter a valid email address.'
            });
        }

        const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernamePattern.test(username)) {
            return res.status(400).json({
                message: 'Username must be 3-20 characters and may only contain letters, numbers and underscores.'
            });
        }

        if (fullName.length < 2) {
            return res.status(400).json({
                message: 'Full name must be at least 2 characters.'
            });
        }

        const hasMinLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);

        if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters and include uppercase, lowercase and a number.'
            });
        }

        const [existingUsers] = await pool.promise().query(
            `SELECT username, email
             FROM users
             WHERE username = ? OR LOWER(email) = ?
             LIMIT 1`,
            [username, email]
        );

        if (existingUsers.length > 0) {
            const existingUser = existingUsers[0];

            if (existingUser.email.toLowerCase() === email) {
                return res.status(409).json({
                    field: 'email',
                    message: 'An account with this email already exists.'
                });
            }

            if (existingUser.username === username) {
                return res.status(409).json({
                    field: 'username',
                    message: 'This username is already taken.'
                });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await pool.promise().query(
            'INSERT INTO users (email, username, full_name, password, role) VALUES (?, ?, ?, ?, ?)',
            [email, username, fullName, hashedPassword, 'user']
        );

        try {
            if (typeof sendRegistrationEmail === 'function') {
                await sendRegistrationEmail({
                    email,
                    username,
                    fullName
                });
            }
        } catch (emailError) {
            console.error('User was registered, but registration email failed:', emailError);
        }

        res.status(201).json({
            message: 'User registered successfully.'
        });
    } catch (error) {
        console.error('Could not register user:', error);
        res.status(500).json({
            message: 'Could not register user.'
        });
    }
});

// Logga in
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await pool.promise().query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({
                loggedIn: false,
                message: 'Felaktigt anvndarnamn'
            });
        }

        const user = users[0];
        const validPassword = await passwordMatches(password, user.password);

        if (!validPassword) {
            return res.status(401).json({
                loggedIn: false,
                message: 'Felaktigt lsenord'
            });
        }

        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        req.session.save((err) => {
            if (err) {
                return res.status(500).json({
                    error: 'Kunde inte spara session'
                });
            }

            res.json({
                loggedIn: true,
                role: user.role
            });
        });
    } catch (error) {
        console.error('Could not log in:', error);
        res.status(500).json({
            error: 'Kunde inte logga in'
        });
    }
});

// Kontrollera om inloggad
app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// Logga ut
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('hotel_session');
        res.json({ loggedIn: false });
    });
});

// Uppdatera anvndarinstllningar
app.put('/api/update-user', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Not logged in" });
    }

    const userId = req.session.user.id;
    const { email, password } = req.body;

    try {
        await pool.promise().query(
            "UPDATE users SET email = ?, password = ? WHERE id = ?",
            [email, password, userId]
        );

        const [userRows] = await pool.promise().query(
            `SELECT email, full_name
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [userId]
        );

        if (userRows.length > 0) {
            await sendUserUpdatedEmail({
                to: userRows[0].email,
                fullName: userRows[0].full_name
            });
        }

        res.json({ message: "User updated successfully" });
    } catch (error) {
        console.error("Could not update user:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Hämta alla bokningar för admin-sidan
app.get('/api/admin/bookings', async (req,res)=>{


 if(!req.session.user || req.session.user.role !== 'admin'){
  return res.status(403).json({message:"Admin only"});
 }


 const sql = `
 SELECT 
 b.id,
 u.username,
 r.room_number,
 r.type,
 b.start_date,
 b.end_date
 FROM bookings b
 JOIN users u ON b.user_id = u.id
 JOIN rooms r ON b.room_id = r.id
 ORDER BY b.start_date ASC
`;
 const [rows] = await pool.promise().query(sql);
 res.json(rows);

});
// API för att ta bort ett rum (endast admin)
app.delete('/api/admin/rooms/:id', async (req,res)=>{


 if(!req.session.user || req.session.user.role !== 'admin'){
  return res.status(403).json({message:"Admin only"});
 }


 const id = req.params.id;
 await pool.promise().query(
 "DELETE FROM rooms WHERE id=?",
 [id]
 );
 res.json({message:"Room deleted"});
});

app.get('/api/admin/stats', async (req,res)=>{
    if(!req.session.user || req.session.user.role !== 'admin'){
     return res.status(403).json({message:"Admin only"});
    }
   
    const [rooms] = await pool.promise().query("SELECT COUNT(*) as total FROM rooms");
    const [bookings] = await pool.promise().query("SELECT COUNT(*) as total FROM bookings");
   
    res.json({
     rooms: rooms[0].total,
     bookings: bookings[0].total
    });
   });


// API för att lägga till ett rum (ADMIN)
app.post('/api/admin/rooms', async (req,res)=>{

 if(!req.session.user || req.session.user.role !== 'admin'){
  return res.status(403).json({message:"Admin only"});
 }

 const {room_number,type,price_per_night,description} = req.body;

 await pool.promise().query(
 "INSERT INTO rooms (room_number,type,price_per_night,description) VALUES (?,?,?,?)",
 [room_number,type,price_per_night,description]
 );

 res.json({message:"Room added"});

});


// LÖSENORDSÅTERSTÄLLNING

// Begär lösenordsåterställning
app.post('/api/forgot-password', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();

    try {
        // Svara alltid neutralt så att man inte kan lista ut vilka e-postadresser som har konto
        const genericResponse = {
            message: 'If an account exists with that email, a password reset link has been sent.'
        };

        if (!email) {
            return res.json(genericResponse);
        }

        const [users] = await pool.promise().query(
            `SELECT id, email, full_name
             FROM users
             WHERE LOWER(email) = ?
             LIMIT 1`,
            [email]
        );

        if (users.length === 0) {
            return res.json(genericResponse);
        }

        const user = users[0];

        // Gör gamla reset-länkar oanvända
        await pool.promise().query(
            `UPDATE password_reset_tokens
             SET used_at = NOW()
             WHERE user_id = ? AND used_at IS NULL`,
            [user.id]
        );

        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashResetToken(token);

        await pool.promise().query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
            [user.id, tokenHash]
        );

        const frontendUrl = process.env.FRONTEND_URL || 'https://hotel-frontend-vi9g.onrender.com';
        const resetLink = `${frontendUrl}/reset-password.html?token=${encodeURIComponent(token)}`;

        await sendPasswordResetEmail({
            to: user.email,
            fullName: user.full_name,
            resetLink
        });

        res.json(genericResponse);
    } catch (error) {
        console.error('Could not process forgot password request:', error);

        // Även vid serverfel ges inte detaljer till användaren
        res.json({
            message: 'If an account exists with that email, a password reset link has been sent.'
        });
    }
});



// Kontrollera om reset-länk är giltig
app.get('/api/reset-password/:token', async (req, res) => {
    const token = String(req.params.token || '');

    try {
        if (!token) {
            return res.status(400).json({
                valid: false,
                message: 'Missing token.'
            });
        }

        const tokenHash = hashResetToken(token);

        const [rows] = await pool.promise().query(
            `SELECT id
             FROM password_reset_tokens
             WHERE token_hash = ?
               AND used_at IS NULL
               AND expires_at > NOW()
             LIMIT 1`,
            [tokenHash]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                valid: false,
                message: 'This password reset link is invalid or has expired.'
            });
        }

        res.json({
            valid: true,
            message: 'Password reset link is valid.'
        });
    } catch (error) {
        console.error('Could not verify reset token:', error);
        res.status(500).json({
            valid: false,
            message: 'Could not verify reset link.'
        });
    }
});

// Sätt nytt lösenord med reset-token
app.post('/api/reset-password', async (req, res) => {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');

    try {
        if (!token) {
            return res.status(400).json({
                message: 'Missing reset token.'
            });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters and include uppercase, lowercase and a number.'
            });
        }

        const tokenHash = hashResetToken(token);

        const [rows] = await pool.promise().query(
            `SELECT prt.id, prt.user_id
             FROM password_reset_tokens prt
             WHERE prt.token_hash = ?
               AND prt.used_at IS NULL
               AND prt.expires_at > NOW()
             LIMIT 1`,
            [tokenHash]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                message: 'This password reset link is invalid or has expired.'
            });
        }

        const resetToken = rows[0];
        const hashedPassword = await bcrypt.hash(password, 12);

        await pool.promise().query(
            `UPDATE users
             SET password = ?
             WHERE id = ?`,
            [hashedPassword, resetToken.user_id]
        );

        await pool.promise().query(
            `UPDATE password_reset_tokens
             SET used_at = NOW()
             WHERE id = ?`,
            [resetToken.id]
        );

        res.json({
            message: 'Password has been updated successfully.'
        });
    } catch (error) {
        console.error('Could not reset password:', error);
        res.status(500).json({
            message: 'Could not reset password.'
        });
    }
});



// Starta servern
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servern körs på http://localhost:${PORT}`);
});