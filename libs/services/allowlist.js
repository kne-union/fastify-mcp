const fp = require('fastify-plugin');
const { findSwaggerOperation, listSwaggerOperations, normalizeMethod, operationKey } = require('../utils/openapi');
const { isDenied } = require('../utils/deny');
const { loadSeedItems } = require('../utils/seeds');
const { createAppError } = require('../utils/error');
const { scenariosFromOperation, confirmFromOperation } = require('../utils/scenarios');

const toRow = record => ({
  id: String(record.id),
  operationId: record.operationId || null,
  method: record.method,
  path: record.path,
  scenarios: Array.isArray(record.scenarios) ? record.scenarios : [],
  confirm: !!record.confirm,
  enabled: !!record.enabled,
  status: record.status,
  source: record.source || 'manual',
  manualFields: Array.isArray(record.manualFields) ? record.manualFields : [],
  seedKey: record.seedKey || null,
  seedGroup: record.seedGroup || null,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
});

const buildSeedKey = (method, apiPath) => `${normalizeMethod(method)} ${apiPath}`;

const SEED_FIELDS = ['scenarios', 'confirm', 'enabled'];

const sameValue = (field, a, b) => {
  if (field === 'scenarios') {
    const left = [...(a || [])].sort();
    const right = [...(b || [])].sort();
    return left.length === right.length && left.every((item, index) => item === right[index]);
  }
  return !!a === !!b;
};

/**
 * 管理端提交的是全量字段，只把与现值不同的字段记为人工改过
 */
const applyManualChanges = (row, next) => {
  const changed = SEED_FIELDS.filter(field => next[field] !== undefined && !sameValue(field, next[field], row[field]));
  if (!changed.length) {
    return next;
  }
  const current = Array.isArray(row.manualFields) ? row.manualFields : [];
  return Object.assign({}, next, { manualFields: Array.from(new Set([...current, ...changed])) });
};

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;
  const err = (messageId, statusCode, values) => createAppError(fastify, options.name, messageId, statusCode, values);

  const getSwagger = () => (typeof options.getSwagger === 'function' ? options.getSwagger() : fastify.swagger());

  const assertNotDenied = apiPath => {
    if (isDenied(apiPath, options.deny || [])) {
      throw err('pathDenied', 400);
    }
  };

  const resolveAgainstSwagger = ({ operationId, method, path: apiPath }) => {
    const hit = findSwaggerOperation(getSwagger(), { operationId, method, path: apiPath });
    if (!hit) {
      throw err('openapiNotFound', 400);
    }
    assertNotDenied(hit.path);
    return hit;
  };

  /** 等待插件启动种子结束，避免首波 MCP/目录请求看到空能力面 */
  const ensureSeeded = async () => {
    const pending = fastify[options.name]?.seedPromise;
    if (pending) {
      await pending;
    }
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
      throw err('allowlistNotFound', 404);
    }
    return toRow(row);
  };

  /**
   * 管理端创建/upsert：新建行 source=manual；已有 seed 行只把实际改动的字段记入 manualFields。
   * 种子请用 upsertSeed。
   */
  const create = async body => {
    const hit = resolveAgainstSwagger(body);
    const [row, created] = await models.allowlist.findOrCreate({
      where: { method: hit.method, path: hit.path },
      defaults: {
        operationId: hit.operationId || body.operationId || null,
        method: hit.method,
        path: hit.path,
        scenarios: Array.isArray(body.scenarios) ? body.scenarios : [],
        confirm: !!body.confirm,
        enabled: body.enabled !== false,
        status: 'active',
        source: 'manual',
        seedKey: null,
        seedGroup: null
      }
    });
    if (!created) {
      await row.update(
        applyManualChanges(row, {
          operationId: hit.operationId || row.operationId,
          scenarios: Array.isArray(body.scenarios) ? body.scenarios : row.scenarios,
          confirm: body.confirm !== undefined ? !!body.confirm : row.confirm,
          enabled: body.enabled !== undefined ? !!body.enabled : row.enabled,
          status: 'active'
        })
      );
    }
    return toRow(row);
  };

  /**
   * 种子 upsert（对齐 message includeTemplate）：
   * - 新建：写入 seed 默认值
   * - 已有 manual（管理端新建）：只刷新 operationId
   * - 已有 seed：scenarios/confirm/enabled 刷新为种子值，manualFields 里人工改过的字段保持不动
   */
  const upsertSeed = async (body, { seedGroup, seedKey } = {}) => {
    const hit = resolveAgainstSwagger(body);
    const key = seedKey || buildSeedKey(hit.method, hit.path);
    const group = seedGroup || 'file';
    const scenarios = Array.isArray(body.scenarios) ? body.scenarios : scenariosFromOperation(hit);
    const confirm = body.confirm !== undefined ? !!body.confirm : confirmFromOperation(hit);
    const [row, created] = await models.allowlist.findOrCreate({
      where: { method: hit.method, path: hit.path },
      defaults: {
        operationId: hit.operationId || body.operationId || null,
        method: hit.method,
        path: hit.path,
        scenarios,
        confirm,
        enabled: body.enabled !== false,
        status: 'active',
        source: 'seed',
        seedKey: key,
        seedGroup: group
      }
    });
    if (created) {
      return { row: toRow(row), created: true, skipped: false };
    }
    if (row.source === 'manual') {
      await row.update({
        operationId: hit.operationId || row.operationId
      });
      return { row: toRow(row), created: false, skipped: true };
    }
    const manualFields = Array.isArray(row.manualFields) ? row.manualFields : [];
    const seedValues = { scenarios, confirm, enabled: body.enabled !== false };
    const updates = {
      operationId: hit.operationId || row.operationId,
      seedKey: key,
      seedGroup: group,
      status: 'active'
    };
    SEED_FIELDS.filter(field => !manualFields.includes(field)).forEach(field => {
      updates[field] = seedValues[field];
    });
    await row.update(updates);
    return { row: toRow(row), created: false, skipped: false };
  };

  const disableMissingSeeds = async ({ seedGroup, seenKeys }) => {
    const rows = await models.allowlist.findAll({
      where: { source: 'seed', seedGroup }
    });
    let disabled = 0;
    for (const row of rows) {
      const key = row.seedKey || buildSeedKey(row.method, row.path);
      if (seenKeys.has(key)) {
        continue;
      }
      if (row.status !== 'missing') {
        // 只改 status（曝光要求 status=active），保留 enabled 以便接口重现后恢复
        await row.update({ status: 'missing' });
        disabled += 1;
        fastify.log.warn(`[fastify-mcp] disable missing seed: ${key}`);
      }
    }
    return disabled;
  };

  const patch = async ({ id, ...body }) => {
    const row = await models.allowlist.findByPk(id);
    if (!row) {
      throw err('allowlistNotFound', 404);
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
    await row.update(applyManualChanges(row, next));
    return toRow(row);
  };

  const remove = async ({ id }) => {
    const row = await models.allowlist.findByPk(id);
    if (!row) {
      throw err('allowlistNotFound', 404);
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

  const listActive = async () => {
    await ensureSeeded();
    const rows = await models.allowlist.findAll({
      where: { enabled: true, status: 'active' },
      order: [['path', 'ASC']]
    });
    return rows.map(toRow);
  };

  /**
   * 从业务仓 seeds 目录导入（对齐 message includeTemplate + disableMissing）。
   */
  const includeSeeds = async (dir, { disableMissing = true } = {}) => {
    const items = await loadSeedItems(dir);
    if (items === null) {
      fastify.log.info('[fastify-mcp] seedsDir not exists, skip includeSeeds');
      return { imported: 0, skipped: 0, disabled: 0 };
    }
    if (!dir) {
      return { imported: 0, skipped: 0, disabled: 0 };
    }
    fastify.log.info('------start include mcp seeds------');
    const seen = new Set();
    let imported = 0;
    let skipped = 0;
    for (const item of items) {
      try {
        const method = normalizeMethod(item.method);
        const apiPath = String(item.path || '').trim();
        const seedKey = item.seedKey || buildSeedKey(method, apiPath);
        seen.add(seedKey);
        const result = await upsertSeed(item, { seedGroup: 'file', seedKey });
        if (result.created) {
          imported += 1;
        } else if (result.skipped) {
          skipped += 1;
        } else {
          imported += 1;
        }
      } catch (e) {
        skipped += 1;
        fastify.log.warn(`[fastify-mcp] skip seed item ${item?.method} ${item?.path}: ${e.message}`);
      }
    }
    let disabled = 0;
    if (disableMissing) {
      disabled = await disableMissingSeeds({ seedGroup: 'file', seenKeys: seen });
    }
    fastify.log.info('------end include mcp seeds------');
    return { imported, skipped, disabled };
  };

  /**
   * 按 swagger 投影播种；默认场景来自 x-mcp-scenarios / tags。
   */
  const seedFromSwagger = async (opts = {}) => {
    const pathPrefix = opts.pathPrefix;
    const disableMissing = opts.disableMissing !== false;
    const getScenarios = typeof opts.getScenarios === 'function' ? opts.getScenarios : scenariosFromOperation;
    const getConfirm = typeof opts.getConfirm === 'function' ? opts.getConfirm : confirmFromOperation;
    // 默认关闭：需管理端显式开放；传 enabled: true 才整批打开
    const enabled = opts.enabled === true;
    const spec = getSwagger();
    const ops = listSwaggerOperations(spec, { pathPrefix }).filter(op => !isDenied(op.path, options.deny || []));
    const seen = new Set();
    let imported = 0;
    let skipped = 0;
    for (const op of ops) {
      try {
        const seedKey = buildSeedKey(op.method, op.path);
        seen.add(seedKey);
        const scenarios = getScenarios(op);
        const result = await upsertSeed(
          {
            method: op.method,
            path: op.path,
            operationId: op.operationId,
            scenarios: Array.isArray(scenarios) ? scenarios : [],
            confirm: !!getConfirm(op),
            enabled
          },
          { seedGroup: 'swagger', seedKey }
        );
        if (result.skipped) {
          skipped += 1;
        } else {
          imported += 1;
        }
      } catch (e) {
        skipped += 1;
        fastify.log.warn(`[fastify-mcp] skip swagger seed ${op.method} ${op.path}: ${e.message}`);
      }
    }
    let disabled = 0;
    if (disableMissing) {
      disabled = await disableMissingSeeds({ seedGroup: 'swagger', seenKeys: seen });
    }
    fastify.log.info(`[fastify-mcp] seedFromSwagger imported=${imported} skipped=${skipped} disabled=${disabled}`);
    return { imported, skipped, disabled };
  };

  fastify[options.name].services.allowlist = {
    list,
    get,
    create,
    patch,
    remove,
    batchUpsert,
    listActive,
    includeSeeds,
    seedFromSwagger,
    upsertSeed,
    ensureSeeded,
    normalizeMethod,
    operationKey,
    resolveAgainstSwagger,
    scenariosFromOperation,
    confirmFromOperation
  };
});
