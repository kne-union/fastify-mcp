/**
 * 从 OpenAPI operation / Fastify route schema 取默认场景。
 * 优先 x-mcp-scenarios（或 mcp.scenarios），否则用 tags。
 */
const scenariosFromOperation = op => {
  const raw = (op && op.operation) || op || {};
  const ext = raw['x-mcp-scenarios'] ?? raw.mcp?.scenarios;
  if (Array.isArray(ext) && ext.length) {
    return ext.map(String).filter(Boolean);
  }
  const tags = Array.isArray(op?.tags) && op.tags.length ? op.tags : raw.tags;
  if (Array.isArray(tags) && tags.length) {
    return tags.map(String).filter(Boolean);
  }
  return [];
};

/**
 * 从 schema 取默认 confirm；未声明时写方法默认 true。
 */
const confirmFromOperation = op => {
  const raw = (op && op.operation) || op || {};
  if (typeof raw['x-mcp-confirm'] === 'boolean') {
    return raw['x-mcp-confirm'];
  }
  if (typeof raw.mcp?.confirm === 'boolean') {
    return raw.mcp.confirm;
  }
  return String(op?.method || '').toUpperCase() !== 'GET';
};

module.exports = { scenariosFromOperation, confirmFromOperation };
