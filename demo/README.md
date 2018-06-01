> An app to demonstrate using the `sails-hook-api-version-accept` Sails.js hook

## How to run this demo
 1. clone this repo
    ```bash
    git clone https://github.com/tomsaleeba/sails-hook-api-version-accept.git
    ```
 1. `cd` to the demo dir
    ```bash
    cd sails-hook-api-version-accept/demo/
    ```
 1. install dependencies
    ```bash
    yarn
    ```
 1. start the server
    ```bash
    npm start
    ```
 1. create some test data
    ```bash
    curl 'http://localhost:1337/foo/create?name=Aaron&secret=bananas'
    curl 'http://localhost:1337/foo/create?name=Bob&secret=pokemon'
    ```
 1. request `Foo` data with `Accept: */*` (which cURL does implicitly)
    ```bash
    curl -v http://localhost:1337/foo
    ```
    The result is data in the latest version format. You can tell by the `Content-type: application/vnd.techotom.v2+json` response header
 1. request `Foo` data in version **1** format
    ```bash
    curl -v -H 'Accept: application/vnd.techotom.v1+json' http://localhost:1337/foo
    ```
    You can tell it worked by the `Content-type` response header and the fact that the response items don't include the `secret` field.
 1. request `Foo` data in version **2** format
    ```bash
    curl -v -H 'Accept: application/vnd.techotom.v2+json' http://localhost:1337/foo
    ```
 1. What if we request `Foo` data in a version that doesn't exist?
    ```console
    $ curl -v -H 'Accept: application/vnd.techotom.v3+json' http://localhost:1337/foo
    < HTTP/1.1 406 Not Acceptable
    ...
    {
      "status": 406,
      "message": "We have no representation to satisfy 'application/vnd.techotom.v3+json'",
      "supportedTypes": [
        "application/vnd.techotom.v1+json",
        "application/vnd.techotom.v2+json"
      ]
    }
    ```
    That's good, it tells us off and lets us know what we can use.
 1. What if we request `Foo` with plain old `Accept: application/json`?
    ```console
    $ curl -v -H 'Accept: application/json' http://localhost:1337/foo
    < HTTP/1.1 406 Not Acceptable
    ...
    {
      "status": 406,
      "message": "We have no representation to satisfy 'application/json'",
      "supportedTypes": [
        "application/vnd.techotom.v1+json",
        "application/vnd.techotom.v2+json"
      ]
    }
    ```
    Again, we get told off. This is so lazy developers don't use this MIME and then complain when the format changes in the future. Force them to be explicit about the version they want!

Now what about our other model, `Bar`, that we have disabled versioning for? This behaves exactly like out-of-the-box Sails.js Blueprints and deals exclusively with the `application/json` MIME.

 1. create some test data
    ```bash
    curl 'http://localhost:1337/bar/create?name=Carl'
    curl 'http://localhost:1337/bar/create?name=Dan'
    ```
 1. request `Bar` data with `Accept: */*` (which cURL does implicitly)
    ```console
    $ curl -v http://localhost:1337/bar
    < Content-Type: application/json; charset=utf-8
    ...
    [
      {
        "createdAt": 1527842665192,
        "updatedAt": 1527842665192,
        "id": 1,
        "name": "Carl"
      },
      {
        "createdAt": 1527842665214,
        "updatedAt": 1527842665214,
        "id": 2,
        "name": "Dan"
      }
    ]
    ```
 1. request `Bar` data with `Accept: application/json`, and it's still happy
    ```bash
    curl -v -H 'Accept: application/json' http://localhost:1337/bar
    < Content-Type: application/json; charset=utf-8
    ...
    (same output as above)
    ```
