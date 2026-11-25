const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_MAX_BYTES = 256 * 1024;

const guideError = (messageId, statusCode) => {
  const error = new Error(messageId);
  error.statusCode = statusCode;
  error.messageId = messageId;
  return error;
};

/**
 * 安全读取引导 Markdown：只读配置路径，realpath 必须落在 rootDir 下。
 */
const readGuideMarkdown = async ({ guideMarkdownPath, guideRootDir, maxGuideBytes = DEFAULT_MAX_BYTES }) => {
  if (!guideMarkdownPath) {
    throw guideError('guideNotConfigured', 404);
  }
  const root = path.resolve(guideRootDir || path.dirname(guideMarkdownPath));
  const resolved = path.resolve(guideMarkdownPath);
  let realFile;
  let realRoot;
  try {
    realRoot = await fs.realpath(root);
  } catch {
    throw guideError('guideFileMissing', 404);
  }
  try {
    realFile = await fs.realpath(resolved);
  } catch {
    throw guideError('guideFileMissing', 404);
  }
  const relative = path.relative(realRoot, realFile);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw guideError('guidePathEscape', 400);
  }
  const stat = await fs.stat(realFile);
  if (!stat.isFile()) {
    throw guideError('guideNotFile', 404);
  }
  if (stat.size > maxGuideBytes) {
    throw guideError('guideTooLarge', 413);
  }
  const content = await fs.readFile(realFile, 'utf8');
  return { content, path: realFile, bytes: Buffer.byteLength(content, 'utf8') };
};

module.exports = { readGuideMarkdown, DEFAULT_MAX_BYTES };
