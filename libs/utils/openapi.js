const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const normalizeMethod = method => {
  const value = String(method || '').toLowerCase();
  if (!HTTP_METHODS.includes(value)) {
    throw new Error(`method 必须是 ${HTTP_METHODS.join(' / ').toUpperCase()} 之一`);
  }
  return value.toUpperCase();
};

const operationKey = (method, path) => `${normalizeMethod(method)} ${path}`;

/**
 * 从 swagger 文档列出 operation（不含 deny 过滤）。
 */
const listSwaggerOperations = (spec, { pathPrefix } = {}) => {
  const result = [];
  Object.keys(spec?.paths || {}).forEach(apiPath => {
    if (pathPrefix && !apiPath.startsWith(pathPrefix)) {
      return;
    }
    HTTP_METHODS.forEach(method => {
      const operation = spec.paths[apiPath][method];
      if (!operation) {
        return;
      }
      result.push({
        operationId: operation.operationId || null,
        method: method.toUpperCase(),
        path: apiPath,
        summary: operation.summary || '',
        description: operation.description || '',
        tags: Array.isArray(operation.tags) ? operation.tags : [],
        operation
      });
    });
  });
  return result;
};

const findSwaggerOperation = (spec, { operationId, method, path: apiPath }) => {
  const list = listSwaggerOperations(spec);
  if (operationId) {
    const byId = list.find(item => item.operationId === operationId);
    if (byId) {
      return byId;
    }
  }
  if (method && apiPath) {
    const key = operationKey(method, apiPath);
    return list.find(item => operationKey(item.method, item.path) === key) || null;
  }
  return null;
};

module.exports = {
  HTTP_METHODS,
  normalizeMethod,
  operationKey,
  listSwaggerOperations,
  findSwaggerOperation
};
