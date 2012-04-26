/*
  a model object that is compatible with xdiff

*/

var x = require('xdiff')
var EventEmitter = require('events').EventEmitter

function XModel () {
  this.root = {}
}

var proto = XModel.prototype = new EventEmitter()

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
    other.on('change', onChange)
    this.unsync = function () {
      other.removeListener('change', onChange)
      this._synced = null
    }
  } else { //assume Repo
    function onPreUpdate () {
      //commit
      try {
        other.commit(self.root)
      } catch (e) {
        //expect no change
      }
    }
    function onUpdate () {
      var _obj = other.checkout()
      var delta = x.diff(self.root, _obj) 
      console.log(delta)
      if(!delta) return
      if(delta) self.patch(delta)
      console.log(self)
    }
    other.on('preupdate', onPreUpdate)
    other.on('update', onUpdate)
    self.unsync = function () {
      other.removeListener('preupdate', onPreUpdate)
      other.removeListener('update', onUpdate)
      self._synced = null
    }
  }
}

proto.at = function (path) {
  if(arguments.length > 1)
    path = [].slice.call(arguments)
  else if('string' == typeof path)
    path = [path]
  console.log(path, this._refs, this.root)
  if(this._refs[path[0]])
    return getPath(this._refs, path)
  return getPath(this, path) 
}

proto.set = function (_path, value) {
  var path = _path.slice()
  var key = path.pop()
  var at = this.at(path)
  var obj = at[key] = value
  this._update('set', path, value)
  return this
}

proto.del = function (_path) {
  var path = _path.slice()
  var key = path.pop()
  var at = this.at(path)
  this._update('del', path) 
  return this
}

proto.splice = function (path, splices) {
  var at = this.at(path)
  for (var i in splices)
    [].splice.apply(at, splices[i])
  this._update('splice', path, splices)
  return this
}

proto._change = function () {
  var args = [].slice.call(arguments)
  this.emit.apply(this, args)
  //TODO: would be better to do this lazy, or only update the inserted objects
  // will be much more PERFORMANT
  this._refs = findRefs(this.root)
  args.unshift('change')
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
}

module.exports = XModel
