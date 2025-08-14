//export function getSocket(){ if(typeof window==='undefined') return null; if(!window.__LL_SOCKET__){ const { io } = require('socket.io-client'); window.__LL_SOCKET__ = io(undefined,{ path:'/api/socket' }); } return window.__LL_SOCKET__; }
// lib/socket.js
export function getSocket() {
    if (typeof window === "undefined") return null;
    if (!window.__LL_SOCKET__) {
        const { io } = require("socket.io-client");
        const url = "https://love-letter-server.vercel.app:4000";//process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
        // If url is undefined, io() will attempt same-origin (useful for local dev where the server is running)
        window.__LL_SOCKET__ = io(url, { path: "/socket.io" });
    }
    return window.__LL_SOCKET__;
}
