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
    }else{
      setTimeout(restoreCache, 5000)
    }
  }catch(e){
    log.error(e)
    setTimeout(restoreCache, 5000)
  }
}
restoreCache()
module.exports = { cache }
