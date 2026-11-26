const fp = require('fastify-plugin');
const path = require('node:path');
const { runAfterReady } = require('./libs/utils/run-after-ready');

/** 默认 deny：密钥路径 + 导出类文件流接口（勿放入 allowlist） */
const recommendDeny = ['**/client/secret/**', '**/secret/**', '**/export-**'];

const normalizeSeedFromSwagger = value => {
  if (!value) {
    return null;
  }
  if (value === true) {
    return {};
  }
  if (typeof value === 'object') {
    return value;
  }
  return null;
};

module.exports = fp(
  async (fastify, options) => {
    options = Object.assign(
      {},
      {
        name: 'mcp',
        prefix: '/api/v1',
        adminPrefix: null,
        dbTableNamePrefix: 't_mcp_',
        deny: recommendDeny,
        catalogPathPrefix: undefined,
        serverInfo: { name: 'fastify-mcp', version: '0.1.0' },
        instructions: undefined,
        // Node 启动根目录（process.cwd()）下的 MCP.md
        guideMarkdownPath: path.resolve(process.cwd(), 'MCP.md'),
        guideRootDir: process.cwd(),
        maxGuideBytes: 256 * 1024,
        maxDescribeGuideChars: 8000,
        bodyLimit: 15 * 1024 * 1024,
        // MCP 进门鉴权由库固定 Bearer 实现；业务只提供 resolveUser
        resolveUser: undefined,
        // 密钥管理页登录鉴权，须写入 request.userInfo.id
        authenticateUser: undefined,
        authenticateAdmin: undefined,
        createInvokeHeaders: undefined,
        registerExtraTools: undefined,
        getSwagger: undefined,
        // 业务仓 allowlist 种子目录，库内不内置业务种子
        seedsDir: null,
        /**
         * ready 后按 swagger 投影写入 allowlist（upsertSeed，不覆盖 manual）。
         * true | { pathPrefix?, getScenarios?, getConfirm?, enabled?, disableMissing? }
         * 默认场景：operation 的 x-mcp-scenarios / mcp.scenarios，否则 tags
         * 默认 enabled=false（对 MCP 开放默认全关）
         */
        seedFromSwagger: null
      },
      options
    );

    if (!fastify.intl || typeof fastify.intl.createError !== 'function') {
      throw new Error('@kne/fastify-mcp requires @kne/fastify-intl to be registered first');
    }
    if (typeof options.resolveUser !== 'function') {
      throw new Error('@kne/fastify-mcp: resolveUser 必填');
    }
    if (typeof options.authenticateUser !== 'function') {
      throw new Error('@kne/fastify-mcp: authenticateUser 必填');
    }

    if (!options.adminPrefix) {
      options.adminPrefix = `${options.prefix}/admin/mcp`;
    }
    if (!options.guideMarkdownPath) {
      options.guideMarkdownPath = path.resolve(process.cwd(), 'MCP.md');
    }
    if (!options.guideRootDir) {
      options.guideRootDir = process.cwd();
    }

    const seedFromSwaggerOpts = normalizeSeedFromSwagger(options.seedFromSwagger);

    fastify.register(require('@kne/fastify-namespace'), {
      options,
      name: options.name,
      modules: [
        ['controllers', path.resolve(__dirname, './libs/controllers')],
        [
          'models',
          await fastify.sequelize.addModels(path.resolve(__dirname, './libs/models'), {
            prefix: options.dbTableNamePrefix
          })
        ],
        ['services', path.resolve(__dirname, './libs/services')],
        ['locale', require('./libs/locale')]
      ]
    });

    // ready 之后再 seed（需 swagger）；不阻塞 pluginTimeout。完成态见 fastify.mcp.seedPromise
    const seedPromise = runAfterReady(fastify, async () => {
      await fastify.sequelize.syncPromise;
      const { services } = fastify[options.name];
      const result = { seedsDir: null, seedFromSwagger: null };
      if (options.seedsDir) {
        result.seedsDir = await services.allowlist.includeSeeds(options.seedsDir);
      }
      if (seedFromSwaggerOpts) {
        result.seedFromSwagger = await services.allowlist.seedFromSwagger(seedFromSwaggerOpts);
      }
      return result;
    });

    seedPromise.catch(err => {
      fastify.log.error({ err }, '[fastify-mcp] seed 失败');
    });

    // namespace 装饰在 register 微任务后才挂上；这里用 then 挂到同一 name 对象上
    fastify.after(() => {
      if (fastify[options.name]) {
        fastify[options.name].seedPromise = seedPromise;
      }
    });
  },
  {
    name: 'fastify-mcp',
    dependencies: ['fastify-sequelize']
  }
);

module.exports.recommendDeny = recommendDeny;
module.exports.readGuideMarkdown = require('./libs/utils/guide').readGuideMarkdown;
module.exports.buildDenyMatcher = require('./libs/utils/deny').isDenied;
module.exports.runAfterReady = runAfterReady;
module.exports.scenariosFromOperation = require('./libs/utils/scenarios').scenariosFromOperation;
module.exports.confirmFromOperation = require('./libs/utils/scenarios').confirmFromOperation;
