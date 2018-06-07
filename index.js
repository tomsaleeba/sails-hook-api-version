const _ = require('@sailshq/lodash')
const accepts = require('accepts') // because req.accents doesn't work in unit tests

const VERSION_CONFIG_KEY = 'versionConfig'
const VERSION_ARRAY_KEY = 'versions'
const VENDOR_PREFIX_KEY = 'vendorPrefix'
const PLACEHOLDER_VERSION = '%version%'
const ACTION_NAME_FIND = 'Find'
const ACTION_NAME_FIND_ONE = 'FindOne'
const ACTION_NAME_CREATE = 'Create'
const ACTION_NAME_UPDATE = 'Update'
const ACTION_NAME_DESTROY = 'Destroy'
const ALL_ACTIONS = [ACTION_NAME_FIND, ACTION_NAME_FIND_ONE, ACTION_NAME_CREATE, ACTION_NAME_UPDATE, ACTION_NAME_DESTROY]

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
      _.each(sails.models, (model, modelIdentity) => {
        if (modelIdentity === 'archive' && defaultArchiveInUse) {
          return
        }
        const versionConfig = model[VERSION_CONFIG_KEY]
        if (typeof(versionConfig) === 'undefined') {
          sails.log.debug(`Model '${modelIdentity}' doesn't define the '${VERSION_CONFIG_KEY}' key, *not* enabling API versioning for this model.`)
          return
        }
        // verify required helpers exist at server startup
        _.each(versionConfig[VERSION_ARRAY_KEY], versionTag => {
          _.each(ALL_ACTIONS, actionName => {
            const mime = buildMime(versionConfig[VENDOR_PREFIX_KEY], versionTag)
            if (isLatestVersionMime(mime, model, modelIdentity)) {
              // latest version doesn't need a helper
              return
            }
            const helperName = buildHelperName(versionTag, modelIdentity, actionName)
            if (!sails.helpers[helperName]) {
              sails.log.error(`'${helperName}' helper is *not* defined. Calls to '${actionName} ${modelIdentity}' with 'Accept: ${mime}' WILL FAIL! Create the helper to fix this.`)
            }
          })
        })
        function bind (shortcutRoute, actionName) {
          const helperTemplate = buildHelperName(PLACEHOLDER_VERSION, modelIdentity, actionName)
          sails.router.bind(shortcutRoute, buildGetWrapper(model, modelIdentity, helperTemplate))
          sails.log.debug(`Applying API versioning to '${shortcutRoute}' route, handled by '${helperTemplate.replace(PLACEHOLDER_VERSION, '*')}'`)
        }
        // TODO handle URL prefix
        bind(`get /${modelIdentity}`, 'Find')
        bind(`get /${modelIdentity}/:id`, 'FindOne')
        bind(`post /${modelIdentity}`, 'Create')
        bind(`patch /${modelIdentity}/:id`, 'Update')
        bind(`delete /${modelIdentity}/:id`, 'Destroy')
        // TODO: bind "to-many" relationship blueprint actions (Add, Remove, Replace)
      })
      // TODO verify we aren't overwriting a custom .ok() response handler
      sails.middleware.responses.ok = customOkResponse
    }
  }

  function buildGetWrapper (model, modelIdentity, helperTemplate) {
    return async function (req, res, proceed) {
      let acceptHeader = req.headers.accept
      sails.log.silly(`${req.method} ${req.path} request has Accept header='${acceptHeader}'`)
      const acceptor = accepts(req)
      const isAcceptAnything = acceptor.type(['*/*'])
      const latestVersionMime = getLatestVersionMime(model, modelIdentity)
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
      if (isLatestVersionMime(selectedMime, model, modelIdentity)) {
        res.forceMime = latestVersionMime
        return proceed()
      }
      const requestedVersion = getRequestedVersion(selectedMime, model[VERSION_CONFIG_KEY])
      const helperName = helperTemplate.replace(PLACEHOLDER_VERSION, requestedVersion)
      const handler = sails.helpers[helperName]
      if (!handler) {
        const msg = `No helper defined '${helperName}'. You need to create and implement that helper!`
        throw new Error(msg)
      }
      const respBody = await handler()
      res.set('Content-type', selectedMime)
      return res.ok(respBody)
    }

    function getValidVersionedMimeTypes () {
      const versionConfig = getVersionConfig(model, modelIdentity)
      const result = versionConfig[VERSION_ARRAY_KEY].reduce((accum, curr) => {
        accum.push(buildMime(versionConfig[VENDOR_PREFIX_KEY], curr))
        return accum
      }, [])
      return result
    }
  }

  function determineSelectedMime (validVersionMimeTypes, req) {
    for (const currMime of validVersionMimeTypes) {
      if (req.accepts(currMime)) {
        return currMime
      }
    }
    return false
  }

  function isLatestVersionMime (mime, model, modelIdentity) {
    const latestVersionMime = getLatestVersionMime(model, modelIdentity)
    return latestVersionMime === mime
  }

  function getLatestVersionMime (model, modelIdentity) {
    const versionConfig = getVersionConfig(model, modelIdentity)
    const versions = versionConfig[VERSION_ARRAY_KEY]
    const latestVersion = _.last(versions)
    return buildMime(versionConfig[VENDOR_PREFIX_KEY], latestVersion)
  }

  function getVersionConfig (model, modelIdentity) {
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

  function getRequestedVersion (mime, versionConfig) {
    const result = mime
      .replace('application/', '')
      .replace('+json', '')
      .replace(versionConfig[VENDOR_PREFIX_KEY], '')
    // TODO verify is a valid version
    return result
  }

  function buildMime (vendorPrefix, versionFragment) {
    return `application/${vendorPrefix}.${versionFragment}+json`
  }

  function buildHelperName (versionTag, modelIdentity, actionName) {
    return `${versionTag}${_.capitalize(modelIdentity.toLowerCase())}${actionName.toLowerCase()}`
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
      res.set('content-type', res.forceMime) // TODO should we add charset?
    }

    if (optionalData === undefined) {
      return res.sendStatus(ok)
    }
    // work around for unit testing, so we don't get overwritten by https://github.com/balderdashy/sails/blob/635ec44316f797237019dfc5b1e14b8085eb960f/lib/router/res.js#L264
    const respBody = JSON.stringify(optionalData)
    return res.status(ok).send(respBody)
  }
}
