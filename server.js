const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const loraRoutes = require('./routes/loraRoutes'); // Import your Lora routes
require('dotenv').config(); // Load environment variables from .env file
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');

// Parse JSON bodies
app.use(cors());
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
  const { deviceId, hours } = req.query;
  const hoursAgo = hours ? parseInt(hours) : 24;
  const cutoffTime = Date.now() - (hoursAgo * 60 * 60 * 1000);

  if (!deviceId) {
    return res.status(400).send('Device ID is required for historical data.');
  }

  db.ref('power_monitor_data')
    .orderByChild('timestamp_server')
    .startAt(new Date(cutoffTime).toISOString())
    .once('value', (snapshot) => {
      const allData = snapshot.val();
      const filteredData = [];
      if (allData) {
        for (const key in allData) {
          if (allData.hasOwnProperty(key)) {
            const entry = allData[key];
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

// --- NEW API ENDPOINT FOR AGGREGATED SUMMARY DATA ---
app.get('/lora/summary', async (req, res) => {
  const { deviceId, hours } = req.query;
  const periodHours = hours ? parseInt(hours) : 24; // Default to 24 hours
  const cutoffTime = Date.now() - (periodHours * 60 * 60 * 1000);

  if (!deviceId) {
    return res.status(400).send('Device ID is required for summary data.');
  }

  try {
    const snapshot = await db.ref('power_monitor_data')
      .orderByChild('timestamp_server')
      .startAt(new Date(cutoffTime).toISOString())
      .once('value');

    const allData = snapshot.val();
    let filteredData = [];

    if (allData) {
      for (const key in allData) {
        if (allData.hasOwnProperty(key)) {
          const entry = allData[key];
          if (entry.deviceId === deviceId) {
            filteredData.push(entry);
          }
        }
      }
    }

    // Process filteredData for summaries
    let totalEnergyInPeriod = 0;
    let minVoltage = Infinity, maxVoltage = -Infinity, avgVoltage = 0;
    let minCurrent = Infinity, maxCurrent = -Infinity, avgCurrent = 0;
    let minPower = Infinity, maxPower = -Infinity, avgPower = 0;
    let dataCount = filteredData.length;

    if (dataCount > 0) {
      // Sort by timestamp to correctly calculate energy difference if cumulative
      filteredData.sort((a, b) => new Date(a.timestamp_server).getTime() - new Date(b.timestamp_server).getTime());

      // If energy is cumulative, calculate difference between last and first reading in period
      const firstEnergy = parseFloat(filteredData[0].energy || 0);
      const lastEnergy = parseFloat(filteredData[filteredData.length - 1].energy || 0);
      totalEnergyInPeriod = lastEnergy - firstEnergy;
      if (totalEnergyInPeriod < 0) { // Handle potential device resets or overflows within the period
          totalEnergyInPeriod = lastEnergy; // Fallback to just the last reading
      }


      let sumVoltage = 0, sumCurrent = 0, sumPower = 0;
      filteredData.forEach(entry => {
        const voltage = parseFloat(entry.voltage || 0);
        const current = parseFloat(entry.current || 0);
        const power = parseFloat(entry.power || 0);

        sumVoltage += voltage;
        sumCurrent += current;
        sumPower += power;

        minVoltage = Math.min(minVoltage, voltage);
        maxVoltage = Math.max(maxVoltage, voltage);
        minCurrent = Math.min(minCurrent, current);
        maxCurrent = Math.max(maxCurrent, current);
        minPower = Math.min(minPower, power);
        maxPower = Math.max(maxPower, power);
      });

      avgVoltage = sumVoltage / dataCount;
      avgCurrent = sumCurrent / dataCount;
      avgPower = sumPower / dataCount;
    }

    res.status(200).json({
      deviceId,
      periodHours,
      totalEnergyWh: totalEnergyInPeriod,
      avgVoltage: dataCount > 0 ? avgVoltage : 0,
      minVoltage: dataCount > 0 ? minVoltage : 0,
      maxVoltage: dataCount > 0 ? maxVoltage : 0,
      avgCurrent: dataCount > 0 ? avgCurrent : 0,
      minCurrent: dataCount > 0 ? minCurrent : 0,
      maxCurrent: dataCount > 0 ? maxCurrent : 0,
      avgPower: dataCount > 0 ? avgPower : 0,
      minPower: dataCount > 0 ? minPower : 0,
      maxPower: dataCount > 0 ? maxPower : 0,
      dataPoints: dataCount
    });

  } catch (errorObject) {
    console.error("❌ Firebase error fetching summary data:", errorObject);
    res.status(500).send("Failed to retrieve summary data");
  }
});
// ---------------------------------------------------

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ESP32 backend running on port ${PORT}`);
});