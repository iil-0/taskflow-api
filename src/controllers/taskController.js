function createTaskController(service) {
  const missing = res => res.status(404).json({ success: false, error: 'Task not found' });
  return {
    create: async (req, res) => {
      const task = await service.createTask(req.taskData);
      res.status(201).location(`/tasks/${task.id}`).json({ success: true, data: task });
    },
    list: async (req, res) => {
      res.json({ success: true, data: await service.getAllTasks() });
    },
    detail: async (req, res) => {
      const task = await service.getTaskById(req.taskId);
      return task ? res.json({ success: true, data: task }) : missing(res);
    },
    update: async (req, res) => {
      const task = await service.updateTask(req.taskId, req.taskData);
      return task ? res.json({ success: true, data: task }) : missing(res);
    },
    remove: async (req, res) => {
      if (!await service.deleteTask(req.taskId)) return missing(res);
      res.json({ success: true, message: 'Task deleted successfully' });
    },
  };
}

module.exports = createTaskController;
