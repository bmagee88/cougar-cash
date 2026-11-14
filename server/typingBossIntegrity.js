const crypto = require('node:crypto');
const { typingWord } = require('../src/TypingBoss/proportionalRules');
const privateState = new WeakMap();
const LOOKAHEAD = 2, BURST_CHARACTERS = 64, CHARACTERS_PER_MS = .03;

function control(state,now=Date.now()) {
  if(!privateState.has(state))privateState.set(state,{leases:new Map(),receipts:new Map(),tokens:0,lastAt:now});
  return privateState.get(state);
}
function issuedWords(session,state,now=Date.now()) {
  const data=control(state,now),start=state.nextWord-state.wordsInAttack;
  const words=[];
  for(let index=start;index<state.nextWord+LOOKAHEAD;index++) {
    let lease=data.leases.get(index);
    if(!lease) {
      lease={ticket:crypto.randomBytes(16).toString('hex'),issuedAt:now};
      data.leases.set(index,lease);
    }
    words.push({index,...typingWord(state,index),ticket:lease.ticket});
  }
  for(const index of data.leases.keys())if(index<start)data.leases.delete(index);
  return words;
}
function publicTypingState(session,state) {
  if(state.wordProtocol!==1)return {...state};
  return {...state,seed:0,issuedWords:issuedWords(session,state)};
}
const fingerprint=record=>crypto.createHash('sha256').update(JSON.stringify([...record.slice(0,7),{ticket:record[7]?.ticket,mistakes:record[7]?.mistakes}])).digest('hex');
function checkRecord(session,state,record,now=Date.now()) {
  const data=control(state,now),[index,text,count,sum,,,,proof]=record;
  if(typeof text!=='string' || !Number.isInteger(count) || !Number.isFinite(sum))throw new Error('Invalid word text or key timing.');
  if(!proof || typeof proof.ticket!=='string' || !/^[a-f0-9]{32}$/.test(proof.ticket) ||
    !Number.isInteger(proof.mistakes) || proof.mistakes<0 || proof.mistakes>10000)throw new Error('A valid issued word ticket and mistake count are required.');
  if(index<state.nextWord) {
    if(data.receipts.get(index)!==fingerprint(record))throw new Error('This word was already acknowledged with a different result. Refresh to reconnect.');
    return;
  }
  const lease=data.leases.get(index);
  if(!lease || lease.ticket!==proof.ticket)throw new Error('This word was not issued to this player.');
  const elapsed=now-Math.max(lease.issuedAt,session.startedAt || lease.issuedAt);
  if(sum>elapsed+150 || (count>1 && sum<count*5))throw new Error('Word timing does not match the server-observed time.');
  if(elapsed+150<Math.max(0,text.length-1)*1000/60)throw new Error('Words arrived too quickly. Your completed word will retry.');
}
function checkBudget(session,state,characters,now=Date.now()) {
  const data=control(state,now),lastAt=Math.max(data.lastAt,session.startedAt || data.lastAt);
  const tokens=Math.min(BURST_CHARACTERS,data.tokens+Math.max(0,now-lastAt)*CHARACTERS_PER_MS);
  if(characters>tokens)throw new Error('Words arrived too quickly. Your completed words will retry shortly.');
  return {tokens:tokens-characters,lastAt:now};
}
function commit(session,state,records,budget) {
  const data=control(state);
  Object.assign(data,budget);
  for(const record of records)data.receipts.set(record[0],fingerprint(record));
  while(data.receipts.size>64)data.receipts.delete(data.receipts.keys().next().value);
  return issuedWords(session,state);
}
module.exports={publicTypingState,issuedWords,checkRecord,checkBudget,commit};
