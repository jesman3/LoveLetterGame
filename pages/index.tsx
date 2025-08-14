import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSocket } from '../lib/socket';
export default function Lobby(){ const router=useRouter(); const [name,setName]=useState(''); const [code,setCode]=useState(''); const [players,setPlayers]=useState<any[]>([]);
useEffect(()=>{ const s=getSocket(); if(!s) return; s.on('players',setPlayers); s.on('start',(g:any)=>router.push(`/game/${g.code}`)); return ()=>{ s.off('players',setPlayers); s.off('start'); }; },[]);
function createGame(){ const s=getSocket(); if(!name) return alert('Enter your name'); s.emit('createGame',{playerName:name},(c:string)=>router.push(`/game/${c}`)); }
function joinGame(){ const s=getSocket(); if(!name) return alert('Enter your name'); if(!code) return alert('Enter game code'); s.emit('joinGame',{code:code.toUpperCase(),playerName:name},(ok:any)=>{ if(!ok) return alert('Failed to join — invalid code or already started.'); router.push(`/game/${code.toUpperCase()}`); }); }
return (<div className='panel' style={{margin:20}}><h1>Love Letter — Lobby</h1><div className='stack' style={{marginTop:12}}><input value={name} onChange={e=>setName(e.target.value)} placeholder='Your name' /><button onClick={createGame}>Create</button></div><div className='stack' style={{marginTop:12}}><input value={code} onChange={e=>setCode(e.target.value)} placeholder='Game code' /><button onClick={joinGame}>Join</button></div><div style={{marginTop:16}}><h3>Lobby players</h3><ul className='list'>{players.map(p=><li key={p.id}>{p.name}</li>)}</ul></div></div>); }
