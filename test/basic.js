const Sails = require('sails').constructor
require('should')

describe('Basic tests ::', () => {

  // Var to hold a running sails app instance
  var sails

  before(function (done) {
    this.timeout(11000)
    sails = new Sails()
    sails.load({
      hooks: {
        'api-version-accept': require('../'),
        grunt: false,
        views: false,
        cors: false,
        csrf: false,
        i18n: false,
        pubsub: false,
        session: false,
      },
      log: {level: 'error'},
      // TODO get models defined
      // something like https://github.com/balderdashy/sails/blob/7c34d3f65b748c416adbffc8e1c2de3bae7eec4a/test/integration/hook.blueprints.index.routes.test.js#L41
      // which the bottom of https://sailsjs.com/documentation/concepts/programmatic-usage says should work
      orm: {
        moduleDefinitions: {
          models: { 'user': {} }
        }
      },
    },(err) => {
      if (err) {return done(err)}
      return done()
    })
  })

  // After tests are complete, lower Sails
  after((done) => {
    if (sails) {
      return sails.lower(done)
    }
    return done()
  })

  it('should not crash when we lift', () => {
    return true
  })

  it('should succeed for a Find action', done => {
    sails.request({
      url: '/user',
      method: 'GET',
      headers: {
        'content-type': '*/*' // TODO change
      }
    }, (err, res, body) => {
      if (err) {return done(err)}
      body.should.be.a.Array.with.lengthOf(1)
      done()
    })
  })
})
