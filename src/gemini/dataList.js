'use strict'
const log = require('logger')
const mongo = require('mongoclient')

const dataList = { botPingMsg: null, botIDs: [], defend: new Set([]), rude: new Set([]), ready: false }

const sync = async()=>{
  try{
    let status = mongo.status()
    if(status){
      let botSettings = (await mongo.find('botSettings', { _id: 'gemini' }, { _id: 0, TTL: 0 }))[0]
      if(botSettings){
        dataList.botIDs = botSettings?.botIDs || []
        dataList.defend = new Set(botSettings?.defend || [])
        dataList.rude = new Set(botSettings?.rude || [])
        dataList.botPingMsg = botSettings?.botPingMsg
      }
      dataList.ready = true
      setTimeout(sync, 10000)
    }else{
      setTimeout(sync, 2000)
    }
  }catch(e){
    log.error(e)
    setTimeout(sync, 5000)
  }
}
sync()

module.exports = { dataList }
