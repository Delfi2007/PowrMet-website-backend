const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const loraRoutes = require('./routes/loraRoutes'); // Import your Lora routes
require('dotenv').config(); 
const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(bodyParser.json());

// Firebase Admin Initialization
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://esp32-iot-842e3-default-rtdb.asia-southeast1.firebasedatabase.app/"
});

// Pass the Firebase DB instance to your routes
app.use('/lora', loraRoutes(admin.database()));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ESP32 backend running on port ${PORT}`);
});