CREATE DATABASE IF NOT EXISTS hotel_db;
USE hotel_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(10) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, 
    price_per_night DECIMAL(10, 2) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    room_id INT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),

    CONSTRAINT check_dates CHECK (end_date > start_date)
);

INSERT INTO rooms (room_number, type, price_per_night, description) VALUES 
('101', 'Single', 800.00, 'Small single room in the corner of the first floor.'),
('102', 'Single', 800.00, 'Small room right next to elevator.'),
('201', 'Double', 1200.00, 'Big room with King size bed.'),
('301', 'Suite', 2500.00, 'Luxurious Suite with a view.');

INSERT INTO users (username, password) VALUES 
('testuser', 'hemligt123'),
('admin', 'adminpass');

SELECT * FROM rooms;