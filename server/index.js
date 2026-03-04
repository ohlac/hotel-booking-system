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


// Registrering av nya användare
app.post('/api/register', async (req, res) => {
    const { email, username, fullName, password } = req.body;

    try {
        // Kolla om användarnamnet redan finns
        const [existingUser] = await pool.promise().query(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Lägg till ny användare i databasen
        await pool.promise().query(
            'INSERT INTO users (email, username, full_name, password, role) VALUES (?, ?, ?, ?, ?)',
            [email, username, fullName, password, 'user']
        );

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Could not register user' });
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


// uppdatera användarinställningar
app.put('/api/update-user', async (req, res) => {
    if (!req.session.user) {
        res.status(401).json({ message: "Not logged in" });
        return;
    }
    const userId = req.session.user.id;
    const email = req.body.email;
    const password = req.body.password;
    try {
        const sql = "UPDATE users SET email = ?, password = ? WHERE id = ?";
        await pool.promise().query(sql, [email, password, userId]);
        res.json({ message: "User updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});


// Starta servern
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servern körs på http://localhost:${PORT}`);
});
