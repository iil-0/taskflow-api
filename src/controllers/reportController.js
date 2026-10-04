module.exports = service => {
  async function summary() {
    const tasks = await service.getAllTasks();
    return tasks.reduce((result, task) => {
      const key = { completed: 'completedTasks', pending: 'pendingTasks', 'in-progress': 'inProgressTasks' }[task.status];
      result[key] += 1;
      return result;
    }, { totalTasks: tasks.length, completedTasks: 0, pendingTasks: 0, inProgressTasks: 0 });
  }

  return {
    completed: async (req, res) => res.json({ success: true, completedTasks: (await summary()).completedTasks }),
    pending: async (req, res) => res.json({ success: true, pendingTasks: (await summary()).pendingTasks }),
    summary: async (req, res) => res.json({ success: true, summary: await summary() }),
  };
};
