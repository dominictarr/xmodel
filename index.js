/*
  a model object that is compatible with xdiff

 x.sync(repo | xmodel | obj)

 var _x = x.at(path...) //path to sub doc

 _x.set(key, value)
 _x.del(key)
 _x.splice(index, del, insert...)

it should be possible to listen for changes on each sub doc.

*/

var x = require('xdiff')
var EventEmitter = require('events').EventEmitter


function XModel (parent, path) {

  this._parent = parent || this
  if(this._parent === this) {
    this.root = {}
    this._refs = findRefs(this.root)
  }
  path = this._path = path || ['root']
  this._at =
    this._parent._refs[path[0]] 
    ? getPath(this._parent._refs, path)
    : getPath(this._parent, path)
}

var proto = XModel.prototype = new EventEmitter()

proto.toJSON = function () {
  return this._at
}

function getPath (obj, path) {
  if(!Array.isArray(path))
    return obj[path]
  for(var i in path) {
    obj = obj[path[i]]
  }
  return obj
}

//should use protocols here instead. http://jeditoolkit.com/2012/03/21/protocol-based-polymorphism.html#post

proto.sync = function (other, read, write) {
  var self = this

  if(this._synced)
    throw new Error('this XModel is already synced')

  this._synced = other
  if(other instanceof XModel) {
    function onChange () {
      var args = [].slice.call(arguments)
      var method = args.shift()
      self[method].apply(self, args)
    }
    other.on('update', onChange)
    this.unsync = function () {
      other.removeListener('update', onChange)
      this._synced = null
    }
  } else { //assume Repo
    var queued = false
    function onPreUpdate () {
      //commit
      try {
        other.commit(self.root)
      } catch (e) {
        //expect no change
        console.error(e)
        //RETHROW IF IT"S not the nochanges error
      }
    }
    function onUpdate () {
      var _obj = other.checkout()
      var delta = x.diff(self.root, _obj) 
      if(!delta) return
      if(delta) self.patch(delta)
    }
    function onSelfUpdate () {
      if(queued) return
      process.nextTick(function () {
        onPreUpdate()
        queued = false
      })
      queued = true
    }
    other.on('preupdate', onPreUpdate)
    other.on('update', onUpdate)
    self.on('update', onSelfUpdate)
    self.unsync = function () {
      other.removeListener('preupdate', onPreUpdate)
      other.removeListener('update', onUpdate)
      self.removeListener('update', onSelfUpdate)
      self._synced = null
    }
  }
}

proto.getRoot = function () {
  return this._parent
}
proto.at = function (path) {
  if(arguments.length > 1)
    path = [].slice.call(arguments)
  else if('string' == typeof path)
    path = [path]

  return new XModel(this._parent, 
    this._parent._refs[path[0]] 
      ? path
      : this._path.concat(path)
    )
}

proto.set = function (key, value) {
  var obj = this._at[key] = value
  this._update('set', this._path.concat(key), value)
  return this
}

proto.del = function (key) {
  delete this._at[key]
  this._update('del', _path) 
  return this
}

proto.splice = function () {
  var args = [].slice.call(arguments)
  ;[].splice.apply(this._at, args)
  this._update('splice', this._path, args)
  return this
}

proto._update = function () {
  var args = [].slice.call(arguments)
  this.emit.apply(this, args)
  //TODO: would be better to do this lazy, or only update the inserted objects
  // will be much more PERFORMANT
  this._refs = findRefs(this.root)
  args.unshift('update')
  this.emit.apply(this, args)
}

function isObject (o) {
  return o && 'object' == typeof o
}

function findRefs(obj, refs) {
  refs = refs || {}
  //add leaves before branches.
  //this will FAIL if there are circular references.

  if(!obj)
    return refs

  for(var k in obj) {
    if(obj[k] && 'object' == typeof obj[k])
      findRefs(obj[k], refs)
  }
  
  if(obj.__id__ && !refs[obj.__id__])
    refs[obj.__id__] = obj
  return refs
}

proto.patch = function (patch) {
  var self = this
  //emit all the changes.
  self.root = x.patch(self.root, patch)
  this._refs = findRefs(this.root)
  patch.forEach(function (change) {
    self.emit.apply(self, change)
  })
  self.emit('update', patch)
}

module.exports = XModel
