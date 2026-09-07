/* PredictIQ screenshot compatibility layer.
 * main.js owns the match-analysis upload and Analyze button.
 * This file intentionally does NOT register a second file-input handler and
 * does NOT replace the Analyze button handler. That used to make the page
 * require odds even though odds are optional.
 */
(function(){
  'use strict';
  function init(){
    const btn=document.getElementById('pickScreenshotBtn');
    const input=document.getElementById('fileInput');
    if(btn&&input&&!btn.dataset.bound){
      btn.dataset.bound='1';
      btn.addEventListener('click',()=>input.click());
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();