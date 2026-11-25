/**
 * ai-interview-flowup 推荐全局 allowlist 种子（创建 / 邀请 / 查结果）。
 * 宿主可 PUT /mcp-allowlist/batch 导入；仍以运行时 swagger 校验为准。
 */
module.exports = [
  { method: 'GET', path: '/api/v1/client/digital/list', scenarios: ['建项目'], confirm: false },
  { method: 'GET', path: '/api/v1/client/question-model/list', scenarios: ['建项目'], confirm: false },
  { method: 'POST', path: '/api/v1/client/project/create', scenarios: ['建项目'], confirm: true },
  { method: 'GET', path: '/api/v1/client/project/list', scenarios: ['建项目', '查结果'], confirm: false },
  { method: 'GET', path: '/api/v1/client/project/detail', scenarios: ['建项目', '邀请', '查结果'], confirm: false },
  { method: 'POST', path: '/api/v1/client/project/status', scenarios: ['建项目'], confirm: true },
  { method: 'GET', path: '/api/v1/client/project-question/question-digital-list', scenarios: ['建项目'], confirm: false },
  { method: 'POST', path: '/api/v1/client/project-question/create', scenarios: ['建项目'], confirm: true },
  { method: 'POST', path: '/api/v1/client/project/batch-invite', scenarios: ['邀请'], confirm: true },
  { method: 'GET', path: '/api/v1/client/project/invite-list', scenarios: ['邀请'], confirm: false },
  { method: 'GET', path: '/api/v1/client/project/interview-list', scenarios: ['查结果'], confirm: false },
  { method: 'GET', path: '/api/v1/client/statistics/dashboard', scenarios: ['查结果'], confirm: false }
];
