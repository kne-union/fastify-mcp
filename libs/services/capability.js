const fp = require('fastify-plugin');
const { listSwaggerOperations, findSwaggerOperation, operationKey } = require('../utils/openapi');
const { isDenied } = require('../utils/deny');
const { truncateText } = require('../utils/truncate');
const { readGuideMarkdown } = require('../utils/guide');
const { createAppError } = require('../utils/error');

module.exports = fp(async (fastify, options) => {
  const err = (messageId, statusCode, values) => createAppError(fastify, options.name, messageId, statusCode, values);
  const getSwagger = () => (typeof options.getSwagger === 'function' ? options.getSwagger() : fastify.swagger());

  const normalizeScenarioList = scenario => {
    if (scenario == null || scenario === '') {
      return [];
    }
    const raw = Array.isArray(scenario) ? scenario : String(scenario).split(',');
    return raw.map(s => String(s).trim()).filter(Boolean);
  };

  const buildCatalog = async ({ keyword, tag, scenario, enabled, limit, perPage, currentPage } = {}) => {
    // 含 enabled=false 的行，避免关闭后丢失 scenarios/confirm 展示
    await fastify[options.name].services.allowlist.ensureSeeded();
    const { pageData: allowRows } = await fastify[options.name].services.allowlist.list({ perPage: 100000, currentPage: 1 });
    const enabledByKey = new Map(allowRows.map(row => [operationKey(row.method, row.path), row]));
    const word = String(keyword || '')
      .trim()
      .toLowerCase();
    const tagWord = String(tag || '')
      .trim()
      .toLowerCase();
    const scenarioList = normalizeScenarioList(scenario).map(s => s.toLowerCase());
    let list = listSwaggerOperations(getSwagger(), { pathPrefix: options.catalogPathPrefix })
      .filter(item => !isDenied(item.path, options.deny || []))
      .map(item => {
        const key = operationKey(item.method, item.path);
        const allow = enabledByKey.get(key);
        return {
          operationId: item.operationId,
          method: item.method,
          path: item.path,
          summary: item.summary,
          tags: item.tags,
          enabled: allow ? !!allow.enabled && allow.status === 'active' : false,
          scenarios: allow?.scenarios || [],
          confirm: !!allow?.confirm
        };
      });
    if (word) {
      list = list.filter(item => `${item.path} ${item.summary} ${item.operationId || ''} ${(item.scenarios || []).join(' ')}`.toLowerCase().includes(word));
    }
    if (tagWord) {
      list = list.filter(item => item.tags.some(t => String(t).toLowerCase().includes(tagWord)));
    }
    // 多选场景：命中任一即可
    if (scenarioList.length) {
      const emptyLabels = new Set(['未分类', 'uncategorized']);
      list = list.filter(item => {
        const scenarios = (item.scenarios || []).map(s => String(s).toLowerCase());
        if (!scenarios.length) {
          return scenarioList.some(s => emptyLabels.has(s));
        }
        return scenarioList.some(s => scenarios.includes(s));
      });
    }
    if (typeof enabled === 'boolean') {
      list = list.filter(item => !!item.enabled === enabled);
    }
    if (limit) {
      list = list.slice(0, limit);
    }
    const totalCount = list.length;
    const pageSize = perPage != null ? Math.max(1, Number(perPage) || 20) : null;
    if (pageSize) {
      const pageNum = Math.max(1, Number(currentPage) || 1);
      list = list.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    }
    return { pageData: list, totalCount };
  };

  const buildIndex = async () => {
    const allowRows = await fastify[options.name].services.allowlist.listActive();
    const spec = getSwagger();
    const index = [];
    for (const row of allowRows) {
      if (isDenied(row.path, options.deny || [])) {
        continue;
      }
      const hit = findSwaggerOperation(spec, {
        operationId: row.operationId,
        method: row.method,
        path: row.path
      });
      if (!hit) {
        continue;
      }
      index.push({
        id: row.id,
        operationId: hit.operationId || row.operationId,
        method: hit.method,
        path: hit.path,
        summary: hit.summary,
        tags: hit.tags,
        scenarios: row.scenarios || [],
        confirm: !!row.confirm,
        operation: hit.operation
      });
    }
    return index;
  };

  const searchApis = async ({ query, tag, scenario, limit = 8 } = {}) => {
    const max = Math.min(Math.max(Number(limit) || 8, 1), 15);
    const index = await buildIndex();
    const q = String(query || '')
      .trim()
      .toLowerCase();
    const tagWord = String(tag || '')
      .trim()
      .toLowerCase();
    const scenarioWord = String(scenario || '')
      .trim()
      .toLowerCase();
    if (!q && !tagWord && !scenarioWord) {
      const byScenario = {};
      index.forEach(item => {
        const keys = item.scenarios.length ? item.scenarios : ['未分类'];
        keys.forEach(name => {
          byScenario[name] = byScenario[name] || [];
          if (byScenario[name].length < 5) {
            byScenario[name].push({
              operationId: item.operationId,
              method: item.method,
              path: item.path,
              summary: item.summary,
              confirm: item.confirm
            });
          }
        });
      });
      return { mode: 'directory', byScenario, hint: '请提供 query（或 tag / scenario）以搜索具体接口' };
    }
    const matched = index
      .filter(item => {
        const text = `${item.path} ${item.summary} ${item.operationId || ''} ${(item.scenarios || []).join(' ')} ${item.tags.join(' ')}`.toLowerCase();
        if (q && !text.includes(q)) {
          return false;
        }
        if (tagWord && !item.tags.some(t => String(t).toLowerCase().includes(tagWord))) {
          return false;
        }
        if (scenarioWord && !(item.scenarios || []).some(s => String(s).toLowerCase().includes(scenarioWord))) {
          return false;
        }
        return true;
      })
      .slice(0, max)
      .map(({ operationId, method, path, summary, scenarios, confirm }) => ({
        operationId,
        method,
        path,
        summary,
        scenarios,
        confirm
      }));
    return { mode: 'search', total: matched.length, items: matched };
  };

  const resolveIndexEntry = async ({ operationId, method, path: apiPath }) => {
    const index = await buildIndex();
    if (operationId) {
      const byId = index.find(item => item.operationId === operationId);
      if (byId) {
        return byId;
      }
    }
    if (method && apiPath) {
      const key = operationKey(method, apiPath);
      return index.find(item => operationKey(item.method, item.path) === key) || null;
    }
    return null;
  };

  const getSchema = async args => {
    const entry = await resolveIndexEntry(args);
    if (!entry) {
      throw err('operationNotInAllowlist', 404);
    }
    const op = entry.operation || {};
    const payload = {
      operationId: entry.operationId,
      method: entry.method,
      path: entry.path,
      summary: entry.summary,
      confirm: entry.confirm,
      parameters: op.parameters || [],
      requestBody: op.requestBody || null,
      responses: op.responses || null
    };
    return truncateText(JSON.stringify(payload, null, 2));
  };

  const describeCapabilities = async () => {
    const index = await buildIndex();
    let guide = '';
    try {
      const doc = await readGuideMarkdown({
        guideMarkdownPath: options.guideMarkdownPath,
        guideRootDir: options.guideRootDir,
        maxGuideBytes: options.maxGuideBytes
      });
      guide = doc.content;
    } catch (e) {
      guide = `（引导文档暂不可用：${e.message}。完整引导见 GET ${options.prefix}/mcp/guide）`;
    }
    const maxGuideInDescribe = options.maxDescribeGuideChars || 8000;
    if (guide.length > maxGuideInDescribe) {
      guide = `${guide.slice(0, maxGuideInDescribe)}\n\n...[引导已截断，完整内容见 GET ${options.prefix}/mcp/guide]`;
    }
    const byScenario = {};
    index.forEach(item => {
      const keys = item.scenarios.length ? item.scenarios : ['未分类'];
      keys.forEach(name => {
        byScenario[name] = byScenario[name] || [];
        byScenario[name].push(`- ${item.method} ${item.path} — ${item.summary}${item.confirm ? '（需确认）' : ''}`);
      });
    });
    const catalog = Object.entries(byScenario)
      .map(([name, lines]) => `### ${name}\n${lines.join('\n')}`)
      .join('\n\n');
    return [
      guide,
      '',
      '## 已开启能力快照',
      catalog || '（当前 allowlist 为空）',
      '',
      '## 用法',
      '1. search_apis 按关键词找到接口',
      '2. call_api mode=schema 查看参数',
      '3. call_api mode=invoke 执行；confirm=true 的接口须传 userConfirmed=true，且先向用户确认'
    ].join('\n');
  };

  fastify[options.name].services.capability = {
    buildCatalog,
    buildIndex,
    searchApis,
    resolveIndexEntry,
    getSchema,
    describeCapabilities
  };
});
