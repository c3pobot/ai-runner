'use strict'
const mongo = require('mongoclient')
const log = require('logger')
const { GoogleGenAI } = require("@google/genai")

const { cache } = require('./cache')
const { dataList } = require('./dataList')
const discord = require('../discordMsg')
let historyTTL = +(process.env.HISTORY_EXPIRE_TTL || 60), messageTTL = +(process.env.MESSAGE_EXPIRE_TTL || 60)


const pruneCache = ()=>{
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
    mongo.set('aiHistory', { _id: POD_NAME }, cache)
  }catch(e){
    log.error(e)
  }
}
const getTTL = (seconds = 60)=>{
  return Date.now() + (seconds * 1000)
}
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

const ai = new GoogleGenAI({ apiKey: API_KEY});

const BOT_OWNER_ID = process.env.BOT_OWNER_ID

const truncateString = (str, maxLength) => {
  if (str.length > maxLength) {
    return str.slice(0, maxLength - 3) + '...'; // -3 for the ellipsis
  }
  return str;
}
const getResponse = async( message, model )=>{
  try{
    if(!message) return
    let response = await ai.models.generateContent({
      model: model,
      contents: message,
    });
    return response?.text
  }catch(e){
    log.error(model)
    log.error(e)
    if(e?.status == 503) return e.status
  }
}
const getResponseRetry = async(message, retry = true)=>{
  try{
    let model = "gemini-2.5-flash"
    if(!retry) model = "gemini-2.5-flash-lite"
    let res = await getResponse(message, model)
    if(res == 503 && retry) return await getResponseRetry(message, false)
    return res
  }catch(e){
    log.error(e)
  }
}
const swapIdForName = (mentions = [], content = [])=>{
  for(let i in mentions){
    for(let a in content){
      if(content[a].includes(mentions[i].id)) content[a] = `@${mentions[i].name}`
    }
  }
}
const getMention = (id, type = 'user')=>{
  if(!id) return
  let str = `<@`
  if(type == 'role') str += '&'
  str += `${id}>`
  return str
}
const swapNameForId = (mentions = [], content = [], type = 'user')=>{
  for(let i in mentions){
    for(let a in content){
      if(content[a]?.toLowerCase()?.trim()?.includes(`@${mentions[i].name?.toLowerCase()}`)) content[a] = getMention(mentions[i].id, type)
    }
  }
}
const getPrompt = (author, content, defendOthers, attackOthers, rudeUser)=>{
  let prompt = `You are a smart-ass, witty Discord bot.
  RULES:
  - Keep it punchy; prefer under ~300 words unless extra detail is needed for correctness.
  - NEVER use slur/hate toward protected classes and NEVER encourage violence.`

  if(rudeUser){
    prompt += `\n  - Reply with a short, witty roast and do NOT provide help`
  }else{
    if(attackOthers){
      prompt += `\n  - Attack mentioned persons.`
    }else{
      if(defendOthers){
        prompt += `\n  - Defend mentioned persons honor`
      }else{
        prompt += `\n  - If the user's latest message is a genuine question or asks for help -> give a correct, practical answer with a snarky edge.`
        prompt += `\n  - If the user's latest message is primarly insults/taunting/bad-faith -> reply with a short, witty roast and do NOT provide help.`
        prompt += `\n  - If it's casual banter -> be playful and brief.`
      }
    }
  }
  prompt += `\nLatest user:
  User: ${author}
  Message: "${content}"

  Respond now in one message, following the rules above.`
  return prompt?.trim()
}
const getMsgContent = async(msg = {})=>{
  let array = msg?.content?.split(' '), msg2send, tempMsg
  if(array?.length == 1 && !msg.reference){
    if(dataList?.botPingMsg) await discord.send({ chId: msg.chId }, { content: dataList?.botPingMsg, message_reference: { message_id: msg.id }})
    return
  }

  for(let i in dataList?.botIDs){
    array = array.filter(x=>!x.includes(dataList?.botIDs[i]))
  }
  if(array?.length == 0) return
  swapIdForName(msg.userMentions, array)
  swapIdForName(msg.roleMentions, array)
  return array.join(' ')?.trim()
}
const getHistory = (msg = {})=>{
  let obj = cache?.message[msg.reference?.messageId]
  if(obj?.type?.id){
    return cache[obj.type][obj.id] || { id: obj.id, type: obj.type, history: [] }
  }
  if(cache?.game[msg.chId]) return cache?.game[msg.chId] || { id: msg.chId, type: 'game', history: [] }
  if(cache?.channel[msg.chId]) return cache?.channel[msg.chId] || { id: msg.chId, type: 'channel', history: [] }
  return cache?.user[`${msg.chId}-${msg.dId}`] || { id: `${msg.chId}-${msg.dId}`, type: 'user', history: [] }
}
const pruneHistory = (msgObj = []) =>{
  let i = +(msgObj?.history.length || 0) - 5000
  if(0 >= i) return
  while(i > 0){
    msgObj?.history.shift()
    i--;
  }
}
const startGame = async(msg = {})=>{
  let msg2send = 'There is already a game running in this channel. You need to tell me to `end game` to end it.'
  if(cache.game[msg.chId]){
    await discord.send({ chId: msg.chId }, { content: msg2send, message_reference: { message_id: msg.id } })
    return
  }
  cache.game[msg.chId] = { id: msg.chId, type: 'game', history: [] }
  return true
}
const endGame = async(msg = {})=>{
  let msg2send = 'no game found in this channel...'
  if(cache.game[msg.chId]){
    delete cache.game[msg.chId]
    msg2send = 'Game ended..'
  }
  await discord.send({ chId: msg.chId }, { content: msg2send, message_reference: { message_id: msg.id } })
}

const startStream = async(msg = {})=>{
  let msg2send = 'Only the bot owner can start a channel ai stream'
  if(BOT_OWNER_ID && msg.dId === BOT_OWNER_ID){
    msg2send = 'There is already a stream running in this channel. You need to tell me to `end stream` to end it.'
    if(!cache.channel[msg.chId]){
      cache.channel[msg.chId] = { id: msg.chId, type: 'channel', history: [] }
      msg2send = 'Stream started.'
    }
  }
  await discord.send({ chId: msg.chId }, { content: msg2send, message_reference: { message_id: msg.id } })
}
const endStream = async(msg = {})=>{
  let msg2send = 'Only the bot owner can end a channel ai stream...'
  if(BOT_OWNER_ID && msg.dId === BOT_OWNER_ID){
    msg2send = 'no game found in this channel...'
    if(cache.channel[msg.chId]){
      delete cache.channel[msg.chId]
      msg2send = 'Stream ended..'
    }
  }
  await discord.send({ chId: msg.chId }, { content: msg2send, message_reference: { message_id: msg.id } })
}
module.exports.process = async(msg = {})=>{
  try{
    let content = await getMsgContent(msg)
    if(!content) return
    pruneCache()

    if(content?.toLowerCase()?.startsWith('lets play a game') || content?.toLowerCase()?.startsWith("let's play a game") || content?.toLowerCase()?.startsWith("let play a game")){
      let status = await startGame(msg)
      if(!status) return
    }
    if(content?.toLowerCase()?.startsWith('end game') || content?.toLowerCase()?.startsWith("end game")){
      await endGame(msg)
      return
    }
    if(content?.toLowerCase()?.startsWith('start stream')){
      await startStream(msg)
      return
    }
    if(content?.toLowerCase()?.startsWith('end stream')){
      await endStream(msg)
      return
    }

    let msgObj = getHistory(msg)
    if(!msgObj?.history) return

    if(msgObj.history.length > 5000) pruneHistory

    let rudeUser, defendMention, attackMention
    if(dataList?.rude?.has(msg.dId)) rudeUser = true
    for(let i in msg.userMentions){
      if(dataList?.rude?.has(msg.userMentions[i])) attackMention = true
      if(dataList?.defend?.has(msg.userMentions[i])) defendMention = true
    }

    msgObj.history.push({ role: 'user', parts: [{ text: getPrompt(`@${msg.username}`, content, defendMention, attackMention, rudeUser) }]})

    let tempMsg = await getResponseRetry(msgObj.history);
    if(!tempMsg) return

    msgObj.history.push({ role: 'model', parts: [{ text: tempMsg }]})

    tempMsg = tempMsg.split(' ')
    swapNameForId(msg.userMentions, tempMsg, 'user')
    swapNameForId(msg.roleMentions, tempMsg, 'role')

    let msg2send = { content: truncateString(tempMsg.join(' '), 2000), message_reference: { message_id: msg.id } }

    let newMsg = await discord.send({ chId: msg.chId }, msg2send)
    if(!newMsg?.id) return

    msgObj.TTL = getTTL(historyTTL)
    cache[msgObj.type][msgObj.id] = JSON.parse(JSON.stringify(msgObj))
    cache.message[newMsg.id] = { id: msgObj.id, type: msgObj.type, TTL: getTTL(messageTTL) }

  }catch(e){
    log.error(e)
  }
}
module.exports.status = () =>{
  if(cache.ready && dataList.ready) return true
}
