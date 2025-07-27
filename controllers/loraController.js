const handleLoraData = (db) => (req, res) => {
  const { deviceId, timestamp, voltage, current, power, energy, rssi } = req.body;

  if (!deviceId || typeof timestamp === 'undefined' || typeof voltage === 'undefined' ||
      typeof current === 'undefined' || typeof power === 'undefined' || typeof energy === 'undefined' ||
      typeof rssi === 'undefined') {
    return res.status(400).send('Invalid data format. Missing one or more required fields.');
  }

  const payload = {
    deviceId: deviceId,
    timestamp_mcu: timestamp,
    voltage: voltage,
    current: current,
    power: power,
    energy: energy,
    rssi: rssi,
    timestamp_server: new Date().toISOString()
  };

  db.ref('power_monitor_data').push(payload)
    .then(() => {
      console.log("✅ Data stored:", payload);
      res.status(200).send("Data stored successfully");
    })
    .catch((error) => {
      console.error("❌ Firebase error:", error);
      res.status(500).send("Failed to store data");
    });
};

module.exports = { handleLoraData };