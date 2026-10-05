const express = require('express');
const createTaskController = require('../controllers/taskController');
const { taskValidation, validateTaskId } = require('../middleware/taskValidation');
const taskQueryValidation = require('../middleware/taskQueryValidation');

module.exports = service => {
  const router = express.Router();
  const controller = createTaskController(service);
  router.post('/', taskValidation, controller.create);
  router.get('/', taskQueryValidation(), controller.list);
  router.get('/:id', validateTaskId, controller.detail);
  router.put('/:id', validateTaskId, taskValidation, controller.update);
  router.delete('/:id', validateTaskId, controller.remove);
  return router;
};
