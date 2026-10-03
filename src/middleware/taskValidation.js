const { STATUSES, PRIORITIES, TASK_FIELDS } = require('../taskModel');

function taskValidation(req, res, next) {
  const body = req.body;
  const fail = error => res.status(400).json({ success: false, error });
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a JSON object');
  }
  for (const field of Object.keys(body)) {
    if (!TASK_FIELDS.includes(field)) return fail(`Unknown or read-only field: ${field}`);
  }
  const taskData = {};
  for (const field of ['title', 'description', 'priority', 'assignee']) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      return fail(`${field} field is required and must be a non-empty string`);
    }
    taskData[field] = body[field].trim();
  }
  if (!PRIORITIES.includes(taskData.priority)) {
    return fail(`priority must be one of: ${PRIORITIES.join(', ')}`);
  }
  if (Object.hasOwn(body, 'status')) {
    if (!STATUSES.includes(body.status)) return fail(`status must be one of: ${STATUSES.join(', ')}`);
    taskData.status = body.status;
  }
  req.taskData = taskData;
  next();
}

function validateTaskId(req, res, next) {
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) {
    return res.status(400).json({ success: false, error: 'id must be a positive safe integer' });
  }
  req.taskId = Number(req.params.id);
  next();
}

module.exports = { taskValidation, validateTaskId };
