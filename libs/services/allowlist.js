const fp = require('fastify-plugin');
const { findSwaggerOperation, normalizeMethod, operationKey } = require('../utils/openapi');
const { isDenied } = require('../utils/deny');
const { loadSeedItems } = require('../utils/seeds');

const toRow = record => ({
  id: String(record.id),
  operationId: record.operationId || null,
  method: record.method,
  path: record.path,
  scenarios: Array.isArray(record.scenarios) ? record.scenarios : [],
  confirm: !!record.confirm,
  enabled: !!record.enabled,
  status: record.status,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
});

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const getSwagger = () => (typeof options.getSwagger === 'function' ? options.getSwagger() : fastify.swagger());

  const assertNotDenied = apiPath => {
    if (isDenied(apiPath, options.deny || [])) {
      throw Object.assign(new Error('该接口在 deny 列表中，不能加入 allowlist'), { statusCode: 400 });
    }
  };

  const resolveAgainstSwagger = ({ operationId, method, path: apiPath }) => {
    const hit = findSwaggerOperation(getSwagger(), { operationId, method, path: apiPath });
    if (!hit) {
      throw Object.assign(new Error('OpenAPI 中不存在该接口'), { statusCode: 400 });
    }
    assertNotDenied(hit.path);
    return hit;
  };

  const list = async ({ perPage = 20, currentPage = 1, keyword, enabled, status } = {}) => {
    const where = {};
    if (typeof enabled === 'boolean') {
      where.enabled = enabled;
    }
    if (status) {
      where.status = status;
    }
    if (keyword) {
      const word = String(keyword).trim();
      where[Op.or] = [{ path: { [Op.like]: `%${word}%` } }, { operationId: { [Op.like]: `%${word}%` } }, { method: { [Op.like]: `%${word}%` } }];
    }
    const { count, rows } = await models.allowlist.findAndCountAll({
      where,
      order: [
        ['updatedAt', 'DESC'],
        ['id', 'DESC']
      ],
      limit: perPage,
      offset: (currentPage - 1) * perPage
    });
    return { pageData: rows.map(toRow), totalCount: count };
  };

  const get = async ({ id }) => {
    const row = await models.allowlist.findByPk(id);
    if (!row) {
      throw Object.assign(new Error('allowlist 记录不存在'), { statusCode: 404 });
    }
    return toRow(row);
  };

  const create = async body => {
    const hit = resolveAgainstSwagger(body);
    const [row] = await models.allowlist.findOrCreate({
      where: { method: hit.method, path: hit.path },
      defaults: {
        operationId: hit.operationId || body.operationId || null,
        method: hit.method,
        path: hit.path,
        scenarios: Array.isArray(body.scenarios) ? body.scenarios : [],
        confirm: !!body.confirm,
        enabled: body.enabled !== false,
        status: 'active'
      }
    });
    if (!row.isNewRecord) {
      await row.update({
        operationId: hit.operationId || row.operationId,
        scenarios: Array.isArray(body.scenarios) ? body.scenarios : row.scenarios,
        confirm: body.confirm !== undefined ? !!body.confirm : row.confirm,
        enabled: body.enabled !== undefined ? !!body.enabled : true,
        status: 'active'
      });
    }
    return toRow(row);
  };

  const patch = async ({ id, ...body }) => {
    const row = await models.allowlist.findByPk(id);
    if (!row) {
      throw Object.assign(new Error('allowlist 记录不存在'), { statusCode: 404 });
    }
    const next = {};
    if (body.scenarios !== undefined) {
      next.scenarios = Array.isArray(body.scenarios) ? body.scenarios : [];
    }
    if (body.confirm !== undefined) {
      next.confirm = !!body.confirm;
    }
    if (body.enabled !== undefined) {
      next.enabled = !!body.enabled;
    }
    if (body.status !== undefined) {
      next.status = body.status;
    }
    await row.update(next);
    return toRow(row);
  };

  const remove = async ({ id }) => {
    const row = await models.allowlist.findByPk(id);
    if (!row) {
      throw Object.assign(new Error('allowlist 记录不存在'), { statusCode: 404 });
    }
    await row.destroy();
    return {};
  };

  const batchUpsert = async ({ items = [] }) => {
    const results = [];
    for (const item of items) {
      results.push(await create(item));
    }
    return { pageData: results, totalCount: results.length };
  };

  const sync = async () => {
    const rows = await models.allowlist.findAll();
    const spec = getSwagger();
    let orphanCount = 0;
    let activeCount = 0;
    for (const row of rows) {
      const hit = findSwaggerOperation(spec, {
        operationId: row.operationId,
        method: row.method,
        path: row.path
      });
      if (!hit || isDenied(hit.path, options.deny || [])) {
        if (row.status !== 'orphan') {
          await row.update({ status: 'orphan', enabled: false });
        }
        orphanCount += 1;
      } else {
        await row.update({
          status: 'active',
          operationId: hit.operationId || row.operationId,
          method: hit.method,
          path: hit.path
        });
        activeCount += 1;
      }
    }
    return { activeCount, orphanCount, totalCount: rows.length };
  };

  const listActive = async () => {
    const rows = await models.allowlist.findAll({
      where: { enabled: true, status: 'active' },
      order: [['path', 'ASC']]
    });
    return rows.map(toRow);
  };

  /**
   * 从业务仓 seeds 目录导入 allowlist（对齐 fastify-message 的 includeTemplate）。
   * 目录不存在则跳过；单条校验失败（deny / 无 OpenAPI）打日志后跳过。
   */
  const includeSeeds = async dir => {
    const items = await loadSeedItems(dir);
    if (items === null) {
      fastify.log.info('[fastify-mcp] seedsDir not exists, skip includeSeeds');
      return { imported: 0, skipped: 0 };
    }
    if (!dir) {
      return { imported: 0, skipped: 0 };
    }
    fastify.log.info('------start include mcp seeds------');
    let imported = 0;
    let skipped = 0;
    for (const item of items) {
      try {
        await create(item);
        imported += 1;
      } catch (e) {
        skipped += 1;
        fastify.log.warn(`[fastify-mcp] skip seed item ${item?.method} ${item?.path}: ${e.message}`);
      }
    }
    fastify.log.info('------end include mcp seeds------');
    return { imported, skipped };
  };

  fastify[options.name].services.allowlist = {
    list,
    get,
    create,
    patch,
    remove,
    batchUpsert,
    sync,
    listActive,
    includeSeeds,
    normalizeMethod,
    operationKey,
    resolveAgainstSwagger
  };
});
