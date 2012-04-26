var Repo = require('snob')
var XModel = require('..')
var a = require('assertions')

var r = new Repo()
var x = new XModel()

x.sync(r)

r.commit({a: 1})

a.deepEqual(x.root, r.checkout())
