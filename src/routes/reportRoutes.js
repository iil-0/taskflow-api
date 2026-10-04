const express = require('express');
const createReportController = require('../controllers/reportController');

module.exports = service => {
  const router = express.Router();
  const controller = createReportController(service);
  router.get('/completed', controller.completed);
  router.get('/pending', controller.pending);
  router.get('/summary', controller.summary);
  return router;
};
