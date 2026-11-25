const { expect } = require('chai');
const { isDenied } = require('../libs/utils/deny');

describe('deny', () => {
  it('matches prefix and glob', () => {
    expect(isDenied('/api/v1/client/secret/create', ['**/client/secret/**'])).to.equal(true);
    expect(isDenied('/api/v1/client/project/list', ['**/client/secret/**'])).to.equal(false);
    expect(isDenied('/api/v1/client/export-pdf', ['**/export-*'])).to.equal(true);
  });
});
