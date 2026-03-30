const counters = {
  auth_success: 0,
  auth_failure: 0,
  content_create: 0,
  content_update: 0,
  content_delete: 0,
  moderation_actions: 0,
};

function inc(name) {
  if (!Object.prototype.hasOwnProperty.call(counters, name)) {
    counters[name] = 0;
  }
  counters[name] += 1;
}

function snapshot() {
  return { ...counters };
}

module.exports = { inc, snapshot };
