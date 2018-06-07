const objectUnderTest = require('../index')
require('should')

describe('Function tests ::', () => {

  it('should extract the version', () => {
    const src = 'application/vnd.example.v1+json'
    const vendorConfig = {
      vendorPrefix: 'vnd.example'
    }
    const result = objectUnderTest()._testonly.getRequestedVersion(src, vendorConfig)
    result.should.eql('v1')
  })
})
