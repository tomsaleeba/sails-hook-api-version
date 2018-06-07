const Sails = require('sails').constructor
require('should')
require('should-http')

describe('Startup tests ::', () => {

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
            'foo': {
              attributes: {
                'name': 'string'
              },
              versionConfig: {
                versions: ['v1', 'v2', 'v3'],
                vendorPrefix: 'vnd.techotom.test.foo'
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
      sails.log.error = () => {} // silence the expected error message, uncomment for troubleshooting
      return done()
    })
  })

  after(done => {
    if (sails) {
      return sails.lower(done)
    }
    return done()
  })

  it('should throw an Error when we make a call that has no helper defined', done => {
    sails.request({
      url: '/foo',
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.techotom.test.foo.v2+json'
      }
    }, (err) => {
      err.should.be.Error()
      err.status.should.eql(500)
      err.body.should.startWith(`Error: No helper defined 'v2foofind'`)
      done()
    })
  })
})
