const fp = require('fastify-plugin');
const path = require('node:path');

module.exports = fp(
  async (fastify, options) => {
    options = Object.assign(
      {},
      {
        name: 'mcp',
        prefix: '/api/v1',
        adminPrefix: null,
        dbTableNamePrefix: 't_mcp_',
        deny: ['**/client/secret/**', '**/secret/**'],
        catalogPathPrefix: undefined,
        serverInfo: { name: 'fastify-mcp', version: '0.1.0' },
        instructions: undefined,
        // Node 启动根目录（process.cwd()）下的 MCP.md
        guideMarkdownPath: path.resolve(process.cwd(), 'MCP.md'),
        guideRootDir: process.cwd(),
        maxGuideBytes: 256 * 1024,
        maxDescribeGuideChars: 8000,
        bodyLimit: 15 * 1024 * 1024,
        authenticate: undefined,
        authenticateGuide: undefined,
        authenticateAdmin: undefined,
        createInvokeHeaders: undefined,
        registerExtraTools: undefined,
        getSwagger: undefined,
        // 业务仓 allowlist 种子目录（对齐 message.templateDir），库内不内置业务种子
        seedsDir: null
      },
      options
    );

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
        ['services', path.resolve(__dirname, './libs/services')]
      ]
    });

    // 对齐 fastify-message：sync 完成后从业务 seedsDir 导入 allowlist
    fastify.register(
      fp(async (fastify, options) => {
        const ns = fastify[options.name];
        ns.seedsReady = options.seedsDir
          ? fastify.sequelize.syncPromise
              .then(() => ns.services.allowlist.includeSeeds(options.seedsDir))
              .catch(e => {
                fastify.log.error(e, '[fastify-mcp] includeSeeds 失败');
              })
          : Promise.resolve();
      }),
      options
    );
  },
  {
    name: 'fastify-mcp',
    dependencies: ['fastify-sequelize']
  }
);

module.exports.recommendDeny = ['**/client/secret/**', '**/secret/**', '**/export-**'];
module.exports.readGuideMarkdown = require('./libs/utils/guide').readGuideMarkdown;
module.exports.buildDenyMatcher = require('./libs/utils/deny').isDenied;
