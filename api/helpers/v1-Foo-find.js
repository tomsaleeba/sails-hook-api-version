module.exports = {
  friendlyName: 'Version 1 GET .find handler',

  description: 'Maps newer versions of the response to the V1 schema',

  inputs: {
  },

  fn: async function (inputs, exits) {
    const rawResult = await Foo.find()
    const mappedToV1 = rawResult.reduce((accum, curr) => {
      delete curr.secret
      accum.push(curr)
      return accum
    }, [])
    return exits.success(mappedToV1)
  }
}
