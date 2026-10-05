const { STATUSES, PRIORITIES } = require('../taskModel');
const SORT_FIELDS = ['createdAt', 'updatedAt', 'title', 'priority', 'status'];

function taskQueryValidation({ requireKeyword = false } = {}) {
  return (req, res, next) => {
    const fail = error => res.status(400).json({ success: false, error });
    const query = req.query;
    const allowed = ['status', 'priority', 'page', 'limit', 'sort', 'order', 'keyword'];
    for (const [key, value] of Object.entries(query)) {
      if (!allowed.includes(key)) return fail(`Unknown query parameter: ${key}`);
      if (typeof value !== 'string' || !value.trim()) return fail(`${key} must be a single non-empty value`);
    }
    for (const [key, choices] of Object.entries({ status: STATUSES, priority: PRIORITIES, sort: SORT_FIELDS, order: ['asc', 'desc'] })) {
      if (query[key] !== undefined && !choices.includes(query[key])) {
        return fail(`${key} must be one of: ${choices.join(', ')}`);
      }
    }
    for (const key of ['page', 'limit']) {
      if (query[key] !== undefined && (!/^[1-9]\d*$/.test(query[key]) || !Number.isSafeInteger(Number(query[key])))) {
        return fail(`${key} must be a positive safe integer`);
      }
    }
    if (requireKeyword && !query.keyword) return fail('keyword query parameter is required');
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    if (!Number.isSafeInteger(page * limit)) return fail('page and limit combination is too large');
    if (req.params.assignee !== undefined && !req.params.assignee.trim()) return fail('assignee must be non-empty');
    req.taskQuery = {
      ...query, page, limit, sort: query.sort ?? 'createdAt', order: query.order ?? 'asc',
      keyword: query.keyword?.trim(), assignee: req.params.assignee?.trim(),
    };
    next();
  };
}

module.exports = taskQueryValidation;
