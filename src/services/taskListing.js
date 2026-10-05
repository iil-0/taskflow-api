const { STATUSES, PRIORITIES } = require('../taskModel');

function listTasks(tasks, { status, priority, page, limit, sort, order }) {
  const filtered = tasks.filter(task =>
    (!status || task.status === status)
    && (!priority || task.priority === priority));

  const compare = (left, right) => {
    if (sort === 'priority') return PRIORITIES.indexOf(left.priority) - PRIORITIES.indexOf(right.priority);
    if (sort === 'status') return STATUSES.indexOf(left.status) - STATUSES.indexOf(right.status);
    if (sort === 'createdAt' || sort === 'updatedAt') return Date.parse(left[sort]) - Date.parse(right[sort]);
    return left.title.localeCompare(right.title, 'tr', { sensitivity: 'base' });
  };
  filtered.sort((left, right) => (compare(left, right) || left.id - right.id) * (order === 'desc' ? -1 : 1));
  return {
    data: filtered.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, totalItems: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
  };
}

module.exports = listTasks;
