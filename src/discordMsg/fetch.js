'use strict'
const log = require('logger')
const fetch = require('node-fetch')
const parseResponse = require('./parseResponse')
const discordUrl = process.env.DISCORD_PROXY || 'https://discord.com'
const BOT_TOKEN = process.env.BOT_TOKEN
log.info('Discord Fetch Proxy : '+discordUrl)

const discordRequest = async(uri, method, body, headers = {})=>{
  try{
    if(BOT_TOKEN) headers['Authorization'] = `Bot ${BOT_TOKEN}`
    let res = await fetch(discordUrl+'/api'+uri, {
      headers: headers,
      method: method,
      body: body,
      timeout: 30000,
      compress: true
    })
    return await parseResponse(res)
  }catch(e){
    if(e?.name) return {error: e.name, message: e.message, type: e.type}
    if(e?.status) return await parseResponse(e)
    log.error(e)
  }
}
const apiRequest = async(uri, method, body, headers = null, retry = true, count = 0)=>{
  let res = await discordRequest(uri, method, body, headers)
  if(res?.error === 'FetchError' && count < 6 && retry){
    count++
    return await apiRequest(uri, method, body, headers, retry, count)
  }
  return res
}
module.exports = async(uri, method, body, headers = null, retry = true)=>{
  if(!uri) return
  let res = await apiRequest(uri, method, body, headers, retry)
  if(res?.status > 300){
    log.error(method+': '+uri)
    log.error(JSON.stringify(res))
    return
  }
  return res
}
