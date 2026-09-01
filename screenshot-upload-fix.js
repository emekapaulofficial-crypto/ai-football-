/* PredictIQ screenshot uploader hardening. Keeps the native file picker working on mobile. */
(function(){
'use strict';
function init(){
 const input=document.getElementById('fileInput'),zone=document.getElementById('dropzone'),status=document.getElementById('ocrStatus');
 if(!input||!zone)return;
 zone.addEventListener('click',function(e){
   if(e.target===input)return;
   e.preventDefault();
   try{input.click();}catch(err){console.warn('File picker could not open',err);if(status)status.textContent='Please tap the upload area again or use your browser file picker.';}
 });
 zone.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click();}});
 zone.setAttribute('role','button');zone.setAttribute('tabindex','0');
 input.addEventListener('click',function(e){e.stopPropagation();});
 input.addEventListener('change',function(){if(input.files&&input.files.length&&status)status.textContent=`${input.files.length} screenshot${input.files.length>1?'s':''} selected. Reading now…`;});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
