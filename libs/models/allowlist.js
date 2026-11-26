module.exports = ({ DataTypes }) => {
  return {
    model: {
      operationId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'operation_id',
        comment: 'OpenAPI operationId'
      },
      method: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'HTTP method'
      },
      path: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'API path'
      },
      scenarios: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        comment: '场景标签'
      },
      confirm: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '写操作是否要求 userConfirmed'
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: '是否对 MCP 可见可调'
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'active',
        comment: 'active | orphan | missing（missing=种子对账未命中）'
      },
      source: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'manual',
        comment: 'seed | manual；manual=管理端新建，种子不接管'
      },
      manualFields: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        field: 'manual_fields',
        comment: 'seed 行上人工改过的字段（scenarios/confirm/enabled），种子重启不再覆盖这些字段'
      },
      seedKey: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'seed_key',
        comment: '种子稳定键，如 GET /api/v1/client/ping'
      },
      seedGroup: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'seed_group',
        comment: 'swagger | file；disableMissing 只对账同组'
      }
    },
    options: {
      comment: 'MCP 全局 allowlist',
      indexes: [
        {
          unique: true,
          fields: ['method', 'path'],
          where: { deleted_at: null }
        }
      ]
    }
  };
};
