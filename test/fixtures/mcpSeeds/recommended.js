module.exports = [
  { method: 'GET', path: '/api/v1/client/ping', scenarios: ['系统'], confirm: false },
  { method: 'GET', path: '/api/v1/client/project/list', scenarios: ['建项目'], confirm: false }
];
