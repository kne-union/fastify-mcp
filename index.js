const fp = require('fastify-plugin');
const path = require('node:path');

/** 默认 deny：密钥路径 + 导出类文件流接口（勿放入 allowlist） */
const recommendDeny = ['**/client/secret/**', '**/secret/**', '**/export-**'];

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
        seedsDir: null
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

    // sync 完成后从业务 seedsDir 导入 allowlist（同 fastify-message 的 templateDir 写法）
    fastify.register(
      fp(async (fastify, options) => {
        const { services } = fastify[options.name];
        fastify.sequelize.syncPromise
          .then(async () => {
            if (options.seedsDir) {
              await services.allowlist.includeSeeds(options.seedsDir);
            }
          })
          .catch(e => fastify.log.error(e, '[fastify-mcp] includeSeeds 失败'));
      }),
      options
    );
  },
  {
    name: 'fastify-mcp',
    dependencies: ['fastify-sequelize']
  }
);

module.exports.recommendDeny = recommendDeny;
module.exports.readGuideMarkdown = require('./libs/utils/guide').readGuideMarkdown;
module.exports.buildDenyMatcher = require('./libs/utils/deny').isDenied;
