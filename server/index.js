require('dotenv').config(); // inställningarna från .env
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const session = require('express-session');

const app = express();

app.set('trust proxy', 1);

// frontend prata med backend
app.use(cors({
    origin: 'https://hotel-frontend-vi9g.onrender.com',
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json()); // för att kunna läsa JSON-data

app.use(session({
    name: 'hotel_session', // namnet på cookie som lagrar sessionen
    secret: 'hemligthotel0', // lösenord för sessionen.
    resave: false,
    saveUninitialized: true,
    proxy: true,
    cookie: { 
        secure: true,
        sameSite: 'none',
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
    res.send('Hotell-API:et fungerar');
});

// hämta alla rum
app.get('/api/rooms', async (req, res) => {
    try {
        // Ställ en fråga till databasen
        const [rows] = await pool.promise().query('SELECT * FROM rooms');
        
        // Skicka tillbaka rum
        res.json(rows);
    } catch (error) {
        console.error('Fel vid hämtning av rum:', error);
        res.status(500).json({ error: 'Kunde inte hämta rum' });
    }
});

// Logga in
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const [users] = await pool.promise().query('SELECT * FROM users WHERE username = ?', [username]); 

        if (users.length === 0) {
            return res.status(401).json({ loggedIn: false, message: 'Felaktigt användarnamn eller lösenord' });
        }

        const user = users[0];

        if (password === user.password) { // OBS OBS OBS lösenord krypteras inte just nu
            //spara användarinfo i sessionen
            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role //admin eller user
            };
            req.session.save((err) => {
                if (err) return res.status(500).json({ error: 'Kunde inte spara session' });
                res.json({ loggedIn: true, role: user.role });
            }); 
            
        } else {
            res.status(401).json({ loggedIn: false, message: 'Felaktigt användarnamn eller lösenord' });
        }
    } catch (error) {
        console.error('Fel vid inloggning:', error);
        res.status(500).json({ error: 'Kunde inte logga in' });
    }
});

// Kolla om redan inloggad
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
        res.clearCookie('hotel_session'); // Rensa cookie
        res.json({ loggedIn: false });
    });
});

// Starta servern
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servern körs på http://localhost:${PORT}`);
});
