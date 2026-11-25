const fp = require('fastify-plugin');
const crypto = require('node:crypto');

const SECRET_BYTES = 32;

const hashSecret = secret => crypto.createHash('sha256').update(String(secret)).digest('hex');

const maskSecret = () => `${'*'.repeat(8)}`;

const parseBearer = authorization => {
  const match = /^Bearer\s+([^.]+)\.([0-9a-fA-F]+)$/i.exec(String(authorization || '').trim());
  if (!match) {
    return null;
  }
  return { keyId: match[1], secret: match[2] };
};

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];

  const toPublic = record => ({
    id: String(record.id),
    name: record.name || '',
    secret: maskSecret(),
    subjectId: String(record.subjectId),
    createdAt: record.createdAt
  });

  const create = async ({ subjectId, name } = {}) => {
    const sid = subjectId == null ? '' : String(subjectId).trim();
    if (!sid) {
      throw Object.assign(new Error('缺少 subjectId'), { statusCode: 400 });
    }
    const secret = crypto.randomBytes(SECRET_BYTES).toString('hex');
    const row = await models.key.create({
      subjectId: sid,
      name: name == null ? '' : String(name),
      secretHash: hashSecret(secret)
    });
    return {
      id: String(row.id),
      name: row.name || '',
      secret,
      createdAt: row.createdAt
    };
  };

  const list = async ({ subjectId, perPage = 20, currentPage = 1 } = {}) => {
    const sid = subjectId == null ? '' : String(subjectId).trim();
    if (!sid) {
      throw Object.assign(new Error('缺少 subjectId'), { statusCode: 400 });
    }
    const { count, rows } = await models.key.findAndCountAll({
      where: { subjectId: sid },
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ],
      limit: perPage,
      offset: (currentPage - 1) * perPage
    });
    return { pageData: rows.map(toPublic), totalCount: count };
  };

  const remove = async ({ subjectId, id } = {}) => {
    const sid = subjectId == null ? '' : String(subjectId).trim();
    const keyId = id == null ? '' : String(id).trim();
    if (!sid || !keyId) {
      throw Object.assign(new Error('缺少 subjectId 或 id'), { statusCode: 400 });
    }
    const row = await models.key.findOne({ where: { id: keyId, subjectId: sid } });
    if (!row) {
      throw Object.assign(new Error('密钥不存在'), { statusCode: 404 });
    }
    await row.destroy();
    return {};
  };

  /**
   * 校验 Bearer keyId.secret，返回 { key }；失败抛 401。
   */
  const verifyBearer = async authorization => {
    const parsed = parseBearer(authorization);
    if (!parsed) {
      throw Object.assign(new Error('认证失败'), { statusCode: 401 });
    }
    const row = await models.key.findByPk(parsed.keyId);
    const expected = Buffer.from(row?.secretHash || '');
    const actual = Buffer.from(hashSecret(parsed.secret));
    if (!row || expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      throw Object.assign(new Error('认证失败'), { statusCode: 401 });
    }
    return {
      key: {
        id: String(row.id),
        subjectId: String(row.subjectId),
        name: row.name || ''
      }
    };
  };

  fastify[options.name].services.key = {
    create,
    list,
    remove,
    verifyBearer,
    hashSecret,
    parseBearer
  };
});
