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
        comment: 'active | orphan'
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
