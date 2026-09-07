/* PredictIQ legacy compatibility loader. The main analysis is now team-first. */
(function(){
'use strict';
function load(src,next){const s=document.createElement('script');s.src=src;s.async=false;s.onload=next;s.onerror=next;document.head.appendChild(s);}
function start(){load('team-data-fallback.js?v=20260907-4',()=>load('analysis-controller.js?v=20260907-2'));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
