const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_MAX_BYTES = 256 * 1024;

/**
 * 安全读取引导 Markdown：只读配置路径，realpath 必须落在 rootDir 下。
 */
const readGuideMarkdown = async ({ guideMarkdownPath, guideRootDir, maxGuideBytes = DEFAULT_MAX_BYTES }) => {
  if (!guideMarkdownPath) {
    const error = new Error('guideMarkdownPath 未配置');
    error.statusCode = 404;
    throw error;
  }
  const root = path.resolve(guideRootDir || path.dirname(guideMarkdownPath));
  const resolved = path.resolve(guideMarkdownPath);
  let realFile;
  let realRoot;
  try {
    realRoot = await fs.realpath(root);
  } catch {
    const error = new Error('引导文档根目录不存在');
    error.statusCode = 404;
    throw error;
  }
  try {
    realFile = await fs.realpath(resolved);
  } catch {
    const error = new Error('引导文档不存在');
    error.statusCode = 404;
    throw error;
  }
  const relative = path.relative(realRoot, realFile);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    const error = new Error('引导文档路径非法');
    error.statusCode = 400;
    throw error;
  }
  const stat = await fs.stat(realFile);
  if (!stat.isFile()) {
    const error = new Error('引导文档不是文件');
    error.statusCode = 404;
    throw error;
  }
  if (stat.size > maxGuideBytes) {
    const error = new Error(`引导文档超过大小限制（${maxGuideBytes} 字节）`);
    error.statusCode = 413;
    throw error;
  }
  const content = await fs.readFile(realFile, 'utf8');
  return { content, path: realFile, bytes: Buffer.byteLength(content, 'utf8') };
};

module.exports = { readGuideMarkdown, DEFAULT_MAX_BYTES };
