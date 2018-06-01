const _ = require('@sailshq/lodash')

const VERSION_CONFIG_KEY = 'versionConfig'
const VERSION_ARRAY_KEY = 'versions'
const VENDOR_PREFIX_KEY = 'vendorPrefix'

module.exports = function (sails) {
  let hook

  return {

    initialize: function(cb) {
      hook = this
      sails.on('router:before', hook.bindBlueprintHooks)
      return cb()
    },
    bindBlueprintHooks: function () {
      var defaultArchiveInUse = _.any(sails.models, model => { return model.archiveModelIdentity === 'archive' })
      _.each(sails.models, (Model, identity) => {
        if (identity === 'archive' && defaultArchiveInUse) {
          return
        }
        const versionConfig = Model[VERSION_CONFIG_KEY]
        if (typeof(versionConfig) === 'undefined') {
          sails.log.debug(`Model '${identity}' doesn't define the '${VERSION_CONFIG_KEY}' key, *not* enabling API versioning for this model.`)
          return
        }
        _.each(versionConfig[VERSION_ARRAY_KEY], tag => {
          const shortcutRoute = `get /${identity}`
          // TODO handle other shadow routes
          // TODO handle URL prefix
          sails.router.bind(shortcutRoute, buildGetWrapper(Model, identity, tag, 'Find'))
          sails.log.debug(`Applying API versioning to '${shortcutRoute}' route`)
        })
      })
      // TODO verify we aren't overwriting a custom .ok() response handler
      sails.middleware.responses.ok = customOkResponse
    }
  }
}

function buildGetWrapper (model, modelIdentity, versionTag, actionName) {
  return async function (req, res, proceed) {
    let acceptHeader = req.headers.accept
    sails.log.silly(`${req.method} ${req.path} request has Accept header='${acceptHeader}'`)
    const isAcceptAnything = req.accepts('*/*')
    const latestVersionMime = getLatestVersionMime()
    if (isAcceptAnything) {
      res.forceMime = latestVersionMime
      return proceed()
    }
    const validVersionMimeTypes = getValidVersionedMimeTypes()
    const selectedMime = determineSelectedMime(validVersionMimeTypes, req)
    if (!selectedMime) {
      return res.status(406).json({
        status: 406,
        message: `We have no representation to satisfy '${acceptHeader}'`,
        supportedTypes: validVersionMimeTypes,
      })
    }
    const isLatestVersionMime = latestVersionMime === selectedMime
    if (isLatestVersionMime) {
      res.forceMime = latestVersionMime
      return proceed()
    }
    const helperName = `${versionTag}${_.capitalize(modelIdentity.toLowerCase())}${actionName.toLowerCase()}`
    const handler = sails.helpers[helperName]
    const respBody = await handler()
    res.set('Content-type', selectedMime)
    return res.ok(respBody)
  }

  function getValidVersionedMimeTypes () {
    const versionConfig = getVersionConfig()
    const result = versionConfig[VERSION_ARRAY_KEY].reduce((accum, curr) => {
      accum.push(buildMime(versionConfig[VENDOR_PREFIX_KEY], curr))
      return accum
    }, [])
    return result
  }

  function determineSelectedMime (validVersionMimeTypes, req) {
    for (const currMime of validVersionMimeTypes) {
      if (req.accepts(currMime)) {
        return currMime
      }
    }
    return false
  }

  function getLatestVersionMime () {
    const versionConfig = getVersionConfig()
    const versions = versionConfig[VERSION_ARRAY_KEY]
    const latestVersion = _.last(versions)
    return buildMime(versionConfig[VENDOR_PREFIX_KEY], latestVersion)
  }

  function buildMime (vendorPrefix, versionFragment) {
    return `application/${vendorPrefix}.${versionFragment}+json`
  }

  function getVersionConfig () {
    const versionConfig = model[VERSION_CONFIG_KEY]
    failIfTrue(!versionConfig,
      `model '${modelIdentity}' needs the '${VERSION_CONFIG_KEY}' field defined.`)
    failIfTrue(!_.isPlainObject(versionConfig),
      `${modelIdentity}.${VERSION_CONFIG_KEY} must be a plain object/dict`)

    const versionList = versionConfig[VERSION_ARRAY_KEY]
    failIfTrue(!versionList,
      `${modelIdentity}.${VERSION_CONFIG_KEY} needs the '${VERSION_ARRAY_KEY}' field defined as string[].`)
    failIfTrue(!_.every(versionList, String),
      `${modelIdentity}.${VERSION_CONFIG_KEY} should have all elements of type 'string'`)
    failIfTrue(versionList.length < 1,
      `${modelIdentity}.${VERSION_CONFIG_KEY} should have at least one element`)
    // TODO validate that versions are in order, perhaps add a flag to force acceptance of any order

    const vendorPrefix = versionConfig[VENDOR_PREFIX_KEY]
    failIfTrue(!vendorPrefix,
      `${modelIdentity}.${VENDOR_PREFIX_KEY} needs the '${VENDOR_PREFIX_KEY}' field defined as string.`)
    failIfTrue(!_.isString(vendorPrefix),
      `${modelIdentity}.${VENDOR_PREFIX_KEY} should be of type 'string'`)
    return versionConfig
  }
}

function failIfTrue (failureIfTrueCondition, msg) {
  if (failureIfTrueCondition) {
    throw new Error(`Config problem: ${msg}`)
  }
}

/**
 * Custom OK (200) response handler to force our MIME type, if required.
 * @param {*} optionalData response body to send
 */
function customOkResponse(optionalData) {
  const res = this.res
  const ok = 200

  if (res.forceMime) {
    sails.log.silly(`Forcing custom MIME: ${res.forceMime}`)
    res.set('Content-type', res.forceMime) // TODO should we add charset?
  }

  if (optionalData === undefined) {
    return res.sendStatus(ok)
  }
  return res.status(ok).send(optionalData)
}
