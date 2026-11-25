/**
 * 创建可翻译业务错误（依赖宿主已注册的 @kne/fastify-intl）。
 * onError / translateError 会按请求语言替换 message。
 */
const createAppError = (fastify, namespaceName, messageId, statusCode, values) => {
  if (!fastify.intl || typeof fastify.intl.createError !== 'function') {
    const error = new Error(`@kne/fastify-mcp requires @kne/fastify-intl (${messageId})`);
    error.statusCode = statusCode || 500;
    return error;
  }
  return Object.assign(fastify.intl.createError(namespaceName, messageId, values || undefined), {
    statusCode: statusCode || 500
  });
};

const sendTranslatedError = async (fastify, request, reply, error, namespaceName = 'mcp') => {
  let err = error;
  if (err?.messageId && !err.intlName) {
    err = createAppError(fastify, namespaceName, err.messageId, err.statusCode || 500, err.messageValues);
  }
  if (fastify.intl && typeof fastify.intl.translateError === 'function') {
    await fastify.intl.translateError(request, err);
  }
  return reply.code(err.statusCode || 500).send({ error: err.message || String(err) });
};

module.exports = { createAppError, sendTranslatedError };
