var a = require('assertions')
var XModel = require('..')
var SET = 'set', DEL = 'del', SPL = 'splice'
var x = new XModel()

x.patch([
  [SET, ['root'], [1, 2, 3]]
])

a.deepEqual(x.root,
  [1, 2, 3])

x.patch([
  [SPL, ['root'], [[0, 1, 'ONE']]]
])

a.deepEqual(x.root,
  ['ONE', 2, 3])

/*
  could create changes on the fly,
  but it will actually be quite tricky
  when forexample an old change overrides a previous one
  so just use diff for now
*/

//okay what about references?

function asRef(id) {
  return '#*=' + id
}

x.patch([
  [SET, ['abc'], {__id__: 'abc'}], 
  [SPL, ['root'], [[3, 0, asRef('abc')]]]
])


var abc = {__id__: 'abc'}
a.deepEqual(x.root,
  ['ONE', 2, 3, abc]
  )
console.log(x)
 a.deepEqual(x.at('abc'), abc)
