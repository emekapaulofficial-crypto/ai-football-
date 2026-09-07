/* PredictIQ legacy compatibility loader. The main analysis is now team-first. */
(function(){
'use strict';
function load(){
 const s=document.createElement('script');
 s.src='analysis-controller.js?v=20260907-1';
 s.async=false;
 document.head.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
