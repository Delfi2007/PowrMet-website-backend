const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const loraRoutes = require('./routes/loraRoutes'); // Import your Lora routes
require('dotenv').config(); // Load environment variables from .env file
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors'); 
// Parse JSON bodies
app.use(bodyParser.json());

// Firebase Admin Initialization
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://esp32-iot-842e3-default-rtdb.asia-southeast1.firebasedatabase.app/"
});

// IMPORTANT: Define db here so it's accessible by the app.get routes
const db = admin.database();

// Pass the Firebase DB instance to your routes (for POST /lora)
app.use('/lora', loraRoutes(db));

// API Endpoint to get the latest data
app.get('/lora/latest', (req, res) => {
  db.ref('power_monitor_data').orderByKey().limitToLast(1).once('value', (snapshot) => {
    const latestData = snapshot.val();
    if (latestData) {
      // snapshot.val() will be an object with one key (the push ID) and the data
      // We want to return just the data object itself
      const key = Object.keys(latestData)[0];
      res.status(200).json(latestData[key]);
    } else {
      res.status(404).send("No data found");
    }
  }, (errorObject) => {
    console.error("❌ Firebase error fetching latest data:", errorObject);
    res.status(500).send("Failed to retrieve latest data");
  });
});

// API Endpoint to get historical data for a specific device (e.g., last 24 hours)
app.get('/lora/history', (req, res) => {
  const { deviceId, hours } = req.query; // Get deviceId and hours from query parameters
  const hoursAgo = hours ? parseInt(hours) : 24; // Default to 24 hours
  // Calculate cutoff timestamp based on current time
  const cutoffTime = Date.now() - (hoursAgo * 60 * 60 * 1000); 

  if (!deviceId) {
    return res.status(400).send('Device ID is required for historical data.');
  }

  // Fetch data, filtering by deviceId and server timestamp
  // Note: Firebase Realtime Database queries are limited.
  // orderByChild and startAt can only filter on one child.
  // We will filter by timestamp_server using startAt, then manually filter by deviceId.
  db.ref('power_monitor_data')
    .orderByChild('timestamp_server') // Order by server timestamp
    .startAt(new Date(cutoffTime).toISOString()) // Start from data after cutoff
    .once('value', (snapshot) => {
      const allData = snapshot.val();
      const filteredData = [];

      if (allData) {
        for (const key in allData) {
          if (allData.hasOwnProperty(key)) {
            const entry = allData[key];
            // Manually filter by deviceId as orderByChild only applies to one child
            if (entry.deviceId === deviceId) {
              filteredData.push(entry);
            }
          }
        }
      }
      res.status(200).json(filteredData);
    }, (errorObject) => {
      console.error("❌ Firebase error fetching historical data:", errorObject);
      res.status(500).send("Failed to retrieve historical data");
    });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ESP32 backend running on port ${PORT}`);
});