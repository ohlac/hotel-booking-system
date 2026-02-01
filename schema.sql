CREATE DATABASE IF NOT EXISTS hotel_booking
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
USE hotel_booking;

CREATE TABLE IF NOT EXISTS users (
id INT AUTO_INCREMENT PRIMARY KEY,
name VARCHAR(100) NOT NULL,
email VARCHAR(100) NOT NULL UNIQUE,
password VARCHAR(255) NOT NULL,
role ENUM('user','admin') DEFAULT 'user',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
 id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(10) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL,
  price_per_night DECIMAL(10,2) NOT NULL,
  beds INT NOT NULL,
  capacity INT NOT NULL,
  status ENUM('available','maintenance') DEFAULT 'available',
  description TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
id INT AUTO_INCREMENT PRIMARY KEY,
user_id INT NOT NULL,
room_id INT NOT NULL,
start_date DATE NOT NULL,
end_date DATE NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT fk_booking_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_booking_room
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX idx_booking_dates ON bookings(start_date, end_date);
CREATE INDEX idx_booking_user ON bookings(user_id);
CREATE INDEX idx_booking_room ON bookings(room_id);






