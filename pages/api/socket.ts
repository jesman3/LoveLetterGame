import { Server } from "socket.io";
type Card = { name:string; value:number };
type Player = { id:string; name:string; hand:Card[]; tokens:number; eliminated:boolean; protected?:boolean };
const games: Map<string, any> = new Map();
export default function handler(req:any,res:any){
  if(res.socket.server.io) return res.end();
  const io=new Server(res.socket.server,{path:'/api/socket'});
  res.socket.server.io=io;
  io.on('connection',(socket:any)=>{
    socket.on('createGame',({playerName},cb)=>{
      const code=Math.random().toString(36).substring(2,6).toUpperCase();
      const game={id:code, players:[{id:socket.id,name:playerName,hand:[],tokens:0,eliminated:false} as Player], deck:[] as Card[], code, started:false, currentPlayerIndex:0, log:[] as string[], chat:[], burn:null as Card|null};
      games.set(code,game);
      socket.join(code);
      cb&&cb(code);
      io.to(code).emit('players',game.players);
    });
    socket.on('joinGame',({code,playerName},cb)=>{
      const game=games.get(code);
      if(!game) return cb&&cb(null);
      if(game.started) return cb&&cb(null);
      const already=game.players.find((p:Player)=>p.id===socket.id);
      if(!already){
        game.players.push({id:socket.id,name:playerName,hand:[],tokens:0,eliminated:false});
        socket.join(code);
        io.to(code).emit('players',game.players);
      }
      cb&&cb(code);
    });
    socket.on('sendChat',({code,message})=>{
      const g=games.get(code);
      if(!g) return;
      const s=g.players.find((p:Player)=>p.id===socket.id);
      if(s){
        const entry={sender:s.name,message,ts:Date.now()};
        g.chat.push(entry);
        io.to(code).emit('chat',entry);
      }
    });
    socket.on('startGame',(code:string)=>{
      const g=games.get(code);
      if(!g||g.started) return;
      g.started=true;
      startRound(g);
      io.to(code).emit('start',g);
      io.to(code).emit('update',g);
    });
    socket.on('playCard',({code,cardIndex,targetId,guessedCard},cb)=>{
      const g=games.get(code);
      if(!g) return;
      const pi=g.players.findIndex((p:Player)=>p.id===socket.id);
      if(pi===-1) return;
      if(pi!==g.currentPlayerIndex){ socket.emit('errorMsg',{message:'Not your turn.'}); return; }
      const pl=g.players[pi] as Player;
      if(pl.eliminated){ socket.emit('errorMsg',{message:'You are eliminated.'}); return; }
      if(cardIndex<0||cardIndex>=pl.hand.length){ socket.emit('errorMsg',{message:'Invalid card index.'}); return; }
      const card=pl.hand[cardIndex];
      const other=pl.hand.find((_:any,i:number)=>i!==cardIndex);
      if(other&&other.name==='Countess'&&(card.name==='King'||card.name==='Prince')){
        socket.emit('errorMsg',{message:'Rule: If you hold the Countess with King/Prince, you must discard the Countess.'});
        return;
      }
      if(targetId){
        const t=g.players.find((p:Player)=>p.id===targetId);
        if(!t){ socket.emit('errorMsg',{message:'Target not found.'}); return; }
        if(t.protected){ socket.emit('errorMsg',{message:`${t.name} is protected by Handmaid.`}); return; }
      }
      const played=pl.hand.splice(cardIndex,1)[0];
      g.log.push(`${pl.name} played ${played.name}.`);
      applyCardEffect(g,pi,played,targetId,guessedCard,io,socket);
      nextTurn(g);
      io.to(code).emit('update',g);
      cb&&cb({ok:true});
    });
  });
  res.end();
}
function createDeck():Card[]{
  const cs:Card[]=[];
  for(let i=0;i<5;i++) cs.push({name:'Guard',value:1});
  for(let i=0;i<2;i++) cs.push({name:'Priest',value:2});
  for(let i=0;i<2;i++) cs.push({name:'Baron',value:3});
  for(let i=0;i<2;i++) cs.push({name:'Handmaid',value:4});
  for(let i=0;i<2;i++) cs.push({name:'Prince',value:5});
  cs.push({name:'King',value:6});
  cs.push({name:'Countess',value:7});
  cs.push({name:'Princess',value:8});
  return shuffle(cs);
}
function shuffle(d:Card[]){ return [...d].sort(()=>Math.random()-0.5); }
function startRound(g:any){
  g.deck=createDeck();
  g.burn=g.deck.pop();
  g.players.forEach((p:Player)=>{ p.hand=[g.deck.pop()]; p.eliminated=false; p.protected=false; });
  g.currentPlayerIndex=0;
  g.log=[];
  const first=g.players[g.currentPlayerIndex] as Player;
  if(g.deck.length>0) first.hand.push(g.deck.pop());
}
function applyCardEffect(g:any, pi:number, card:Card, targetId:string|null, guessedCard:string|null, io:any, socket:any){
  const pl=g.players[pi] as Player;
  const tgt= targetId? g.players.find((p:Player)=>p.id===targetId) as Player : null;
  switch(card.name){
    case 'Guard':{
      if(!tgt){ socket.emit('errorMsg',{message:'Guard requires a target.'}); return;}
      if(!guessedCard||guessedCard==='Guard'){ socket.emit('errorMsg',{message:'Invalid guess for Guard.'}); return;}
      if(!tgt.hand||tgt.hand.length===0){ socket.emit('errorMsg',{message:'Target has no cards to guess.'}); return;}
      const actual=tgt.hand[0].name;
      if(actual===guessedCard){ tgt.eliminated=true; g.log.push(`${pl.name} guessed ${guessedCard} correctly — ${tgt.name} is eliminated.`); }
      else { g.log.push(`${pl.name} guessed ${guessedCard} — wrong.`); }
      break;
    }
    case 'Priest':{
      if(!tgt){ socket.emit('errorMsg',{message:'Priest requires a target.'}); return;}
      if(!tgt.hand||tgt.hand.length===0){ socket.emit('errorMsg',{message:'Target has no cards to reveal.'}); return;}
      io.to(pl.id).emit('privateReveal',{ targetId:tgt.id, card:tgt.hand[0] });
      g.log.push(`${pl.name} used Priest on ${tgt.name}.`);
      break;
    }
    case 'Baron':{
      if(!tgt){ socket.emit('errorMsg',{message:'Baron requires a target.'}); return;}
      const my=pl.hand[0]; const th=tgt.hand[0];
      if(!my||!th){ socket.emit('errorMsg',{message:'Both players must have a card to compare.'}); return;}
      if(my.value>th.value){ tgt.eliminated=true; g.log.push(`${pl.name} (${my.name}) beat ${tgt.name} (${th.name}).`); }
      else if(my.value<th.value){ pl.eliminated=true; g.log.push(`${tgt.name} (${th.name}) beat ${pl.name} (${my.name}).`); }
      else { g.log.push(`${pl.name} and ${tgt.name} tied with ${my.name}.`); }
      break;
    }
    case 'Handmaid':{
      pl.protected=true;
      g.log.push(`${pl.name} is protected until their next turn.`);
      break;
    }
    case 'Prince':{
      if(!tgt){ socket.emit('errorMsg',{message:'Prince requires a target (can be yourself).'}); return;}
      if(!tgt.hand||tgt.hand.length===0){ socket.emit('errorMsg',{message:'Target has no cards to discard.'}); return;}
      const discarded=tgt.hand.pop()!;
      g.log.push(`${tgt.name} discarded ${discarded.name} due to Prince.`);
      if(discarded.name==='Princess'){ tgt.eliminated=true; g.log.push(`${tgt.name} discarded the Princess and was eliminated.`); }
      else { if(g.deck.length>0) tgt.hand=[g.deck.pop()]; else tgt.hand=[]; }
      break;
    }
    case 'King':{
      if(!tgt){ socket.emit('errorMsg',{message:'King requires a target.'}); return;}
      if(!pl.hand[0]||!tgt.hand[0]){ socket.emit('errorMsg',{message:'Both players must have a card to swap.'}); return;}
      const tmp=pl.hand[0]; pl.hand[0]=tgt.hand[0]; tgt.hand[0]=tmp;
      g.log.push(`${pl.name} swapped hands with ${tgt.name}.`);
      break;
    }
    case 'Countess':{ g.log.push(`${pl.name} discarded the Countess.`); break; }
    case 'Princess':{ pl.eliminated=true; g.log.push(`${pl.name} discarded the Princess and was eliminated.`); break; }
  }
}
function nextTurn(g:any){
  const active=g.players.filter((p:Player)=>!p.eliminated);
  if(active.length<=1){
    const w=active[0];
    if(w) w.tokens=(w.tokens||0)+1;
    g.log.push(`${w? w.name : 'No one'} won the round (last player standing).`);
    startRound(g);
    return;
  }
  if(g.deck.length===0){
    const living=g.players.filter((p:Player)=>!p.eliminated&&p.hand&&p.hand.length>0);
    if(living.length>0){
      living.sort((a:Player,b:Player)=>b.hand[0].value-a.hand[0].value);
      const w=living[0];
      w.tokens=(w.tokens||0)+1;
      g.log.push(`${w.name} won the round (highest card when deck empty).`);
    }
    startRound(g);
    return;
  }
  do{ g.currentPlayerIndex=(g.currentPlayerIndex+1)%g.players.length; } while(g.players[g.currentPlayerIndex].eliminated);
  if(g.players[g.currentPlayerIndex].protected) delete g.players[g.currentPlayerIndex].protected;
  const cur=g.players[g.currentPlayerIndex] as Player;
  if(g.deck.length>0) cur.hand.push(g.deck.pop());
}
export const config = { api: { bodyParser: false } };
