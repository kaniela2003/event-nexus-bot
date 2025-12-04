const cron = require('node-cron');
const { log } = require('./logger');

const tasks = new Map();
function schedule(name, cronExpression, fn) {
  if (tasks.has(name)) tasks.get(name).stop();
  const task = cron.schedule(cronExpression, async () => {
    try { await fn(); } catch (err) { log(`Task "${name}" failed:`, err.message); }
  });
  tasks.set(name, task);
  log(`Scheduled task "${name}" with cron "${cronExpression}"`);
  return task;
}
function stop(name) {
  if (tasks.has(name)) {
    tasks.get(name).stop();
    tasks.delete(name);
    log(`Stopped task "${name}"`);
  }
}
module.exports = { schedule, stop };