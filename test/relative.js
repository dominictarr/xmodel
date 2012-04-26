var XModel = require('..')
var a = require('assertions')

var x = new XModel()

x
  .set('key', 'value')
  .set('key2', 'value2')
  .set('array', [])

var ary = x.at('array')
ary.splice(0, 0, 'hello')

a.deepEqual(x.toJSON(), {
  key: 'value',
  key2: 'value2',
  array: ['hello']
})

//XXX MORE TESTS !!!
