module.exports = {
  resolveUserRequired: '未配置 resolveUser',
  authenticateUserRequired: '未配置 authenticateUser',
  authenticateUserMissingId: 'authenticateUser 须写入 request.userInfo.id',
  authenticationFailed: '认证失败',
  subjectIdRequired: '缺少 subjectId',
  subjectIdOrIdRequired: '缺少 subjectId 或 id',
  keyNotFound: '密钥不存在',
  pathDenied: '该接口在 deny 列表中，不能加入 allowlist',
  openapiNotFound: 'OpenAPI 中不存在该接口',
  allowlistNotFound: 'allowlist 记录不存在',
  guideNotConfigured: '未配置 guideMarkdownPath',
  guideFileMissing: '引导文件不存在',
  guidePathEscape: '引导文件路径非法',
  guideNotFile: '引导路径不是文件',
  guideTooLarge: '引导文件过大'
};
