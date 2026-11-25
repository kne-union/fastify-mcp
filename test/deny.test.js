const { expect } = require('chai');
const mcp = require('../index');
const { isDenied } = require('../libs/utils/deny');

describe('deny', () => {
  it('matches prefix and glob', () => {
    expect(isDenied('/api/v1/client/secret/create', ['**/client/secret/**'])).to.equal(true);
    expect(isDenied('/api/v1/client/project/list', ['**/client/secret/**'])).to.equal(false);
    expect(isDenied('/api/v1/client/export-pdf', ['**/export-*'])).to.equal(true);
  });

  it('recommendDeny is the plugin default and blocks secret + export', () => {
    expect(mcp.recommendDeny).to.deep.equal(['**/client/secret/**', '**/secret/**', '**/export-**']);
    expect(isDenied('/api/v1/client/secret/list', mcp.recommendDeny)).to.equal(true);
    expect(isDenied('/api/v1/client/project/export-pdf', mcp.recommendDeny)).to.equal(true);
    expect(isDenied('/api/v1/client/project/list', mcp.recommendDeny)).to.equal(false);
  });
});
