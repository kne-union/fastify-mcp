/**
 * 永远不对 MCP Catalog / Index 开放的路径规则。
 * 支持精确前缀、双星通配、含子串匹配。勿在注释中写星号斜杠以免提前结束注释。
 */
const DEFAULT_DENY = ['**/client/secret/**', '**/secret/'];

const normalizePath = path => String(path || '').split('?')[0];

const matchRule = (path, rule) => {
  const value = normalizePath(path);
  const pattern = String(rule || '');
  if (!pattern) {
    return false;
  }
  if (pattern.includes('**')) {
    const parts = pattern.split('**').map(part => part.replace(/\*/g, '[^/]*'));
    const re = new RegExp(`^${parts.join('.*')}$`);
    if (re.test(value)) {
      return true;
    }
    // `**/secret/` 也匹配以 /secret 结尾（无尾斜杠）
    if (pattern.endsWith('/')) {
      const leaf = pattern.replace(/\/+$/, '');
      const leafParts = leaf.split('**').map(part => part.replace(/\*/g, '[^/]*'));
      return new RegExp(`^${leafParts.join('.*')}$`).test(value);
    }
    return false;
  }
  if (pattern.endsWith('/')) {
    return value.includes(pattern) || value.endsWith(pattern.slice(0, -1));
  }
  return value === pattern || value.startsWith(`${pattern}/`);
};

const isDenied = (path, deny = DEFAULT_DENY) => (deny || []).some(rule => matchRule(path, rule));

module.exports = { DEFAULT_DENY, isDenied, matchRule, normalizePath };
