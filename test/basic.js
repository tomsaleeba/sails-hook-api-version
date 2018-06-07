const Sails = require('sails').constructor
require('should')
require('should-http')

describe('Basic tests ::', () => {

  var sails

  before(done => {
    (new Sails()).load({
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
      orm: {
        moduleDefinitions: {
          models: {
            'user': {
              attributes: {
                'name': 'string'
              },
              versionConfig: {
                versions: ['v1', 'v2', 'v3'],
                vendorPrefix: 'vnd.techotom.test.user'
              }
            }
          }
        }
      },
      models: {
        migrate: 'drop',
        attributes: {
          id: { type: 'number', autoIncrement: true}
        }
      },
    },(err, _sails) => {
      if (err) {return done(err)}
      sails = _sails
      createUserInstances(sails)
      return done()
    })
  })

  // After tests are complete, lower Sails
  after(done => {
    if (sails) {
      return sails.lower(done)
    }
    return done()
  })

  it('should not crash when we lift', () => {
    return true
  })

  it('should succeed for a Find action that Accepts anything', done => {
    sails.request({
      url: '/user',
      method: 'GET',
      headers: {
        'Accept': '*/*'
      }
    }, (err, res, bodyStr) => {
      if (err) {return done(err)}
      const body = JSON.parse(bodyStr)
      body.should.be.Array().with.lengthOf(2)
      res.should.have.contentType('application/vnd.techotom.test.user.v3+json')
      done()
    })
  })
})

function createUserInstances (sails) {
  sails.request('GET /user/create?name=Carl', (err) => {
    if (err) {throw err}
  })
  sails.request('GET /user/create?name=Lenny', (err) => {
    if (err) {throw err}
  })
}
