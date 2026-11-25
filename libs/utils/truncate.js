const DEFAULT_LIMIT = 40000;

const truncateText = (text, limit = DEFAULT_LIMIT) => {
  const value = typeof text === 'string' ? text : String(text ?? '');
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n...[已截断 ${value.length - limit} 个字符，请缩小查询范围后重试]`;
};

module.exports = { truncateText, DEFAULT_LIMIT };
