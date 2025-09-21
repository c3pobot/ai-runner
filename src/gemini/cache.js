'use strict'
const log = require('logger')
const mongo = require('mongoclient')

let POD_NAME = process.env.POD_NAME || 'ai-runner', CHECK_INTERVAL = 20
const cache = { channel: {}, game: {}, user: {}, ready: false, message: {} }

const restoreCache = async()=>{
  try{
    let status = mongo.status()
    if(status){
      let history = (await mongo.find('aiHistory', { _id: POD_NAME}))[0]
      if(history){
        if(history.channel) cache.channel = history.channel
        if(history.game) cache.game = history.game
        if(history.user) cache.user = history.user
        if(history.message) cache.message = history.message
      }
      log.info(`ai history for ${POD_NAME} restored`)
      cache.ready = true
      pruneCache()
    }else{
      setTimeout(restoreCache, 5000)
    }
  }catch(e){
    log.error(e)
    setTimeout(restoreCache, 5000)
  }
}
const pruneCache = async()=>{
  try{
    let timeNow = Date.now()
    for(let i in cache.user){
      if(!cache.user[i]) continue;
      if(cache.user[i].TTL < timeNow) delete cache.user[i]
    }
    for(let i in cache?.message){
      if(!cache?.message[i]) continue;
      if(cache?.message[i].TTL < timeNow) delete cache.message[i]
    }
    await mongo.set('aiHistory', { _id: POD_NAME }, cache)
    //log.debug(`${POD_NAME} ai history backed up...`)
    setTimeout(pruneCache, CHECK_INTERVAL * 1000)
  }catch(e){
    log.error(e)
    setTimeout(pruneCache, 5000)
  }
}
restoreCache()
module.exports = { cache }
