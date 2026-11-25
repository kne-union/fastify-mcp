const fp = require('fastify-plugin');
const qs = require('qs');
const { normalizeMethod } = require('../utils/openapi');
const { truncateText } = require('../utils/truncate');

module.exports = fp(async (fastify, options) => {
  const callApi = async ({ operationId, method, path: apiPath, query, body, userConfirmed, mode }, ctx = {}) => {
    const { services } = fastify[options.name];
    if (mode === 'schema') {
      return { text: await services.capability.getSchema({ operationId, method, path: apiPath }) };
    }
    const entry = await services.capability.resolveIndexEntry({ operationId, method, path: apiPath });
    if (!entry) {
      return { text: '接口未在 allowlist 中或 OpenAPI 不存在', isError: true };
    }
    if (entry.confirm && !userConfirmed) {
      return {
        text: '该接口标记为需确认（confirm=true）。请先向用户确认，再以 userConfirmed=true 调用。',
        isError: true
      };
    }
    const safeMethod = normalizeMethod(method || entry.method);
    const safePath = entry.path;
    const queryString = query && typeof query === 'object' ? qs.stringify(query) : '';
    const headers = {
      ...(typeof options.createInvokeHeaders === 'function' ? options.createInvokeHeaders(ctx) || {} : {})
    };
    const injectOptions = {
      method: safeMethod,
      url: queryString ? `${safePath}?${queryString}` : safePath,
      headers
    };
    if (safeMethod !== 'GET' && safeMethod !== 'DELETE') {
      headers['content-type'] = headers['content-type'] || 'application/json';
      injectOptions.payload = JSON.stringify(body && typeof body === 'object' ? body : {});
    }
    const response = await fastify.inject(injectOptions);
    return {
      text: truncateText(response.body || ''),
      isError: response.statusCode >= 400,
      statusCode: response.statusCode
    };
  };

  fastify[options.name].services.invoke = { callApi };
});
