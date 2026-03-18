require('dotenv').config(); // inställningarna från .env
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const session = require('express-session');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


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
    if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
    
    try {
        const bookingId = req.params.id;
        const userId = req.session.user.id;
        // userId används i villkoret så att man bara kan radera sina egna bokningar
        await pool.promise().query('DELETE FROM bookings WHERE id = ? AND user_id = ?', [bookingId, userId]);
        res.json({ message: "Booking cancelled" });
    } catch (error) {
        res.status(500).json({ message: "Could not cancel booking" });
    }
});

// Avboka en bokning (endast admin)
app.delete('/api/admin/bookings/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin only" });
    }

    try {
        await pool.promise().query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
        res.json({ message: "Booking cancelled by admin" });
    } catch (error) {
        res.status(500).json({ message: "Could not cancel booking" });
    }
});



// Registrera
app.post('/api/register', async (req, res) => {
    const { email, username, fullName, password } = req.body;
    try {
        const [existingUser] = await pool.promise().query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser.length > 0) return res.status(400).json({ error: 'Username or email already exists' });
        
        await pool.promise().query(
            'INSERT INTO users (email, username, full_name, password, role) VALUES (?, ?, ?, ?, ?)',
            [email, username, fullName, password, 'user']
        );
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Could not register user' });
    }
});

// Logga in
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await pool.promise().query('SELECT * FROM users WHERE username = ?', [username]); 
        if (users.length === 0) return res.status(401).json({ loggedIn: false, message: 'Felaktigt användarnamn' });
        
        const user = users[0];
        if (password === user.password) {
            req.session.user = { id: user.id, username: user.username, role: user.role };
            req.session.save((err) => {
                if (err) return res.status(500).json({ error: 'Kunde inte spara session' });
                res.json({ loggedIn: true, role: user.role });
            }); 
        } else {
            res.status(401).json({ loggedIn: false, message: 'Felaktigt lösenord' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Kunde inte logga in' });
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

// Uppdatera användarinställningar
app.put('/api/update-user', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
    const userId = req.session.user.id;
    const { email, password } = req.body;
    try {
        await pool.promise().query("UPDATE users SET email = ?, password = ? WHERE id = ?", [email, password, userId]);
        res.json({ message: "User updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Starta servern
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servern körs på http://localhost:${PORT}`);
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

