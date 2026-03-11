require('dotenv').config(); // inställningarna från .env
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const session = require('express-session');
const app = express();


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
    secret: 'hemligthotel0', // lösenord för sessionen.
    resave: false,
    saveUninitialized: true,
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
app.post('/api/bookings', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "You need to log in first." });
    
    const { roomId, startDate, endDate } = req.body;
    const userId = req.session.user.id;
    
    try { 
        const sql = "INSERT INTO bookings (user_id, room_id, start_date, end_date) VALUES (?, ?, ?, ?)";
        await pool.promise().query(sql, [userId, roomId, startDate, endDate]);
        res.status(201).json({ message: "Booking created successfully" });
    } catch (error) {
        console.error("Fel vid bokning:", error);
        res.status(500).json({ message: "Could not book room" });
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

