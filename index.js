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
        guideMarkdownPath: undefined,
        guideRootDir: undefined,
        maxGuideBytes: 256 * 1024,
        maxDescribeGuideChars: 8000,
        bodyLimit: 15 * 1024 * 1024,
        authenticate: undefined,
        authenticateGuide: undefined,
        authenticateAdmin: undefined,
        createInvokeHeaders: undefined,
        registerExtraTools: undefined,
        getSwagger: undefined
      },
      options
    );

    if (!options.adminPrefix) {
      options.adminPrefix = `${options.prefix}/admin/mcp`;
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
  },
  {
    name: 'fastify-mcp',
    dependencies: ['fastify-sequelize']
  }
);

module.exports.recommendDeny = ['**/client/secret/**', '**/secret/**', '**/export-**'];
module.exports.flowupRecommendedAllowlist = require('./libs/seeds/flowup-recommended');
module.exports.readGuideMarkdown = require('./libs/utils/guide').readGuideMarkdown;
module.exports.buildDenyMatcher = require('./libs/utils/deny').isDenied;
