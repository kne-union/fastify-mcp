module.exports = ({ DataTypes }) => {
  return {
    model: {
      subjectId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'subject_id',
        comment: '密钥所属主体（业务 userInfo.id）'
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '',
        comment: '密钥名称'
      },
      secretHash: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'secret_hash',
        comment: 'secret 的 sha256 hex'
      }
    },
    options: {
      comment: 'MCP Bearer 密钥',
      indexes: [
        {
          fields: ['subject_id'],
          where: { deleted_at: null }
        }
      ]
    }
  };
};
