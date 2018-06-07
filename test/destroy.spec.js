const _ = require('@sailshq/lodash')
const Sails = require('sails').constructor
require('should')
require('should-http')

describe('Destroy tests ::', () => {

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
      globals: {
        _: _,
        models: true,
        async: false,
        sails: false,
      },
      log: {level: 'error'},
      orm: {
        moduleDefinitions: {
          models: {
            'user': {
              attributes: {
                'name': 'string',
                'phone': 'string',
                'address': 'string',
              },
              versionConfig: {
                versions: ['v1', 'v2', 'v3'],
                vendorPrefix: 'vnd.techotom.test.user'
              }
            }
          }
        }
      },
      helpers: {
        moduleDefinitions: {
          'v2userdestroy': {
            inputs: {
              id: {
                type: 'string',
                required: true
              }
            },
            fn: async function (inputs, exits) {
              const deleteTarget = await user.findOne({
                id: inputs.id
              })
              await user.destroy({
                id: inputs.id
              })
              delete deleteTarget.address
              return exits.success(deleteTarget)
            }
          },
          'v1userdestroy': {
            inputs: {
              id: {
                type: 'string',
                required: true
              }
            },
            fn: async function (inputs, exits) {
              const deleteTarget = await user.findOne({
                id: inputs.id
              })
              await user.destroy({
                id: inputs.id
              })
              delete deleteTarget.address
              delete deleteTarget.phone
              return exits.success(deleteTarget)
            }
          },
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
      createUserInstances(done)
    })
  })

  after(done => {
    if (sails) {
      return sails.lower(done)
    }
    return done()
  })

  it('should be able to perform Destroy on the latest version', done => {
    getOneUserId(done, userId => {
      sails.request({
        url: `/user/${userId}`,
        method: 'DELETE',
        headers: {
          'Accept': 'application/vnd.techotom.test.user.v3+json'
        }
      }, (err, _, bodyStr) => {
        if (err) { return done(err) }
        const userRecord = JSON.parse(bodyStr)
        userRecord.should.have.properties(['id', 'name', 'phone', 'address'])
        done()
      })
    })
  })

  it('should be able to perform Destroy on version v2', done => {
    getOneUserId(done, userId => {
      sails.request({
        url: `/user/${userId}`,
        method: 'DELETE',
        headers: {
          'Accept': 'application/vnd.techotom.test.user.v2+json'
        }
      }, (err, _, bodyStr) => {
        if (err) { return done(err) }
        const userRecord = JSON.parse(bodyStr)
        userRecord.should.have.properties(['id', 'name', 'phone'])
        userRecord.should.not.have.property('address')
        done()
      })
    })
  })

  it('should be able to perform Destroy on version v1', done => {
    getOneUserId(done, userId => {
      sails.request({
        url: `/user/${userId}`,
        method: 'DELETE',
        headers: {
          'Accept': 'application/vnd.techotom.test.user.v1+json'
        }
      }, (err, _, bodyStr) => {
        if (err) { return done(err) }
        const userRecord = JSON.parse(bodyStr)
        userRecord.should.have.properties(['id', 'name'])
        userRecord.should.not.have.properties(['address', 'phone'])
        done()
      })
    })
  })
})

function getOneUserId (done, cb) {
  user.find({
    limit: 1
  }).then((result) => {
    cb(result[0].id)
  }).catch(done)
}

function createUserInstances (done) {
  user.create({
    name: 'Aaron',
    address: '123 Fake St',
    phone: 1111
  }).then(() => {
    return user.create({
      name: 'Bob',
      address: '456 Blah St',
      phone: 2222
    })
  }).then(() => {
    return user.create({
      name: 'Craig',
      address: '789 Whatever St',
      phone: 3333
    })
  }).then(() => {
    done()
  }).catch(done)
}
