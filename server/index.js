require('dotenv').config(); // inställningarna från .env
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// frontend prata med backend
app.use(cors());
app.use(express.json()); // för att kunna läsa JSON-data

// kopplingen till Aiven-databasen
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false // Krävs ofta för Aiven
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test-route för att se att servern fungerar
app.get('/', (req, res) => {
    res.send('Hotell-API:et fungerar');
});

// route för att hämta alla rum
// När frontend anropar /api/rooms, körs denna kod
app.get('/api/rooms', async (req, res) => {
    try {
        // Ställ en fråga till databasen
        const [rows] = await pool.promise().query('SELECT * FROM rooms');
        
        // Skicka tillbaka svaret (rummen) till frontend
        res.json(rows);
    } catch (error) {
        console.error('Fel vid hämtning av rum:', error);
        res.status(500).json({ error: 'Kunde inte hämta rum' });
    }
});

// Starta servern
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servern körs på http://localhost:${PORT}`);
});
