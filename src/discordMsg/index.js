'use strict'
const fetch = require('./fetch')


module.exports.send = async( obj = {}, msg2send)=>{
  if(!obj.chId || !msg2send) return
  let uri = `/channels/${obj.chId}/messages`
  if(typeof content != 'object' && typeof content == 'string') msg2send = { content: msg2send }
  let res = await fetch(uri, 'POST', JSON.stringify(msg2send), { "Content-Type": "application/json" })
  if(res?.status === 200) return res?.body
}
