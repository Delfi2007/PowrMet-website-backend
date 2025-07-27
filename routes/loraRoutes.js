const express = require('express');
const { handleLoraData } = require('../controllers/loraController');

module.exports = (db) => { // Accept db as an argument
  const router = express.Router();
  router.post('/', handleLoraData(db)); // Use the controller function
  return router;
};