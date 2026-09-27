'use strict';
const CACHE='tateniyomu-shell-v1';
const url=path=>new URL(path,self.registration.scope).href;
const SHELL=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'].map(url);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('tateniyomu-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(url('index.html'),response.clone());return response;}return (await caches.match(url('index.html')))||response;}catch{return (await caches.match(url('index.html')))||Response.error();}})());
  }else if(SHELL.includes(request.url)){
    event.respondWith((async()=>{const cached=await caches.match(request);return cached||fetch(request);})());
  }
});
