> An app demonstrating a Sails.js hook that enables API versioning via the Accept header

## How to use this hook

 1. install the hook into your project
    ```bash
      yarn add sails-hook-api-version-accept
    ```
 1. enable the hook in your `.sailsrc`
    ```js
    /* .sailsrc */
    {
      "generators": {...
      "_generatedWith": {...
      "hooks": {
        "api-version": true /* <- add this line */
      }
    }
    ```
 1. on each of your models that you want versioned, you need to add the `versionConfig` field
    ```js
    module.exports = {
      attributes: {...
      versionConfig: { /* <- add this config */
        versions: ['v1', 'v2'],
        vendorPrefix: 'vnd.techotom',
      }
    }
    ```
  1. for versions that aren't the latest, you need to define some helpers to service those requests. Each helper will match the pattern: `api/helpers/<version>-<model>-<action>.js`. For example, for `version=v1`, `model=Foo` and `action=Find` we would create a helper with the file name: `api/helpers/v1-Foo-Find.js`. You can create the file by hand or use the sails generator:
    ```bash
    sails generate helper v1FooFind
    ```
  1. implement the helper(s) you've just created. You can do this however you see fit. As an example, to implement an older `find` action, it makes sense to call the `.find()` action (effectively getting the results for the latest version), then transform the result before sending the response. See [`demo/api/helpers/v1FooFind.js`](https://github.com/tomsaleeba/sails-hook-api-version/tree/master/demo/api/helpers/v1FooFind.js) for an example.

## Reference for `versionConfig` object

| field name | type | example | description
|---|---|---|---|
| `versionConfig` | `{}` | `{versions: [], vendorPrefix: 'string'}` | The container object for the config
| `versionConfig.versions` | `string[]` | `['v1', 'v2']` | Each element represents a version. Make sure your names have [legal](https://tools.ietf.org/html/rfc7231#section-3.1.1.5) syntax for Content-types. The order of element **is important**; the last element is implicitly the latest version. The recommendation is to keep it simple: `['v1', 'v2', 'v3', ...]`.
| `versionConfig.vendorPrefix` | `string` | `vnd.example` | It is suggested that you use the [vendor tree](https://tools.ietf.org/html/rfc6838#section-3.2) prefix of `vnd.` and then some subtree of that for your project. You're *meant* to register them with IANA but you can probably write your API first and worry about that later when it starts to take off. This value will be inserted into the MIME like `application/<vendorPrefix>.v1+json`.

## Why create this hook?

RESTful API Versioning has a number of schools of thought, you can read some background at the following links:

 - https://www.troyhunt.com/your-api-versioning-is-wrong-which-is/
 - https://www.narwhl.com/content-negotiation/

Troy captures the different schools of thought concisely:

>...let me outline the three common schools of thought in terms of how they’re practically implemented:
>
> 1. URL: You simply whack the API version into the URL, for example: https://haveibeenpwned.com/api/v2/breachedaccount/foo
> 1. Custom request header: You use the same URL as before but add a header such as “api-version: 2”
> 1. Accept header: You modify the accept header to specify the version, for example “Accept: application/vnd.haveibeenpwned.v2+json”

I like option 3. I also like Sails.js. This repo is my attempt to add support for API versioning whilst also keeping all the things that make Sails awesome.

## What this hook does
This hook tries to leave as much as possible to pure Sails and only step in when required. This means:

 1. you define version config on the models you want versioned
 1. requests for the latest version, or `*/*`, just use the Sails Blueprint or whatever default handler you have. The only difference is this hook will force the `Content-type` response header to be the correct, versioned MIME.
 1. requests for earlier versions rely on Sails [helpers](https://sailsjs.com/documentation/concepts/helpers) that you must write

## Assumptions
 1. you're using the hook from the start for a new project. You can use it for existing projects, it might require more work to add though.
 1. you have Blueprint shadow routes enabled

## TODO
 1. work out how to handle deleted fields in a given Model. This requires that the model can still store the old field but requests for newer versions don't include it. Perhaps we can add an optional config param that defines which version is the `default`, so you can pin that to a version and write helpers for newer versions.
 1. handle all the other blueprint routes
 1. add lots of tests
