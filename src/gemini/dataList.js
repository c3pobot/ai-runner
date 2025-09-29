'use strict'
const log = require('logger')
const mongo = require('mongoclient')

const BOT_OWNER_ID = process.env.BOT_OWNER_ID
const dataList = { botPingMsg: null, botIDs: [], defend: new Set([]), rude: new Set([]), ready: false, allowed: new Set([]) }

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
      let allowedIDs = await mongo.find('discordId', {}, { _id: 1, ai: 1 })
      dataList.allowed = new Set(allowedIDs?.filter(x=>x?.ai)?.map(x=>x._id) || [])

      if(BOT_OWNER_ID) dataList.allowed.add(BOT_OWNER_ID)
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
