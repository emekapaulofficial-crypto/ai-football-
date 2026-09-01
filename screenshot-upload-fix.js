/* PredictIQ mobile OCR hardening: bypass the old slow handler and give visible progress. */
(function(){
'use strict';
function init(){
 const oldInput=document.getElementById('fileInput'),zone=document.getElementById('dropzone'),status=document.getElementById('ocrStatus');
 if(!oldInput||!zone)return;
 const input=oldInput.cloneNode(true);
 oldInput.parentNode.replaceChild(input,oldInput);
 zone.setAttribute('role','button');zone.setAttribute('tabindex','0');
 const openPicker=()=>{try{input.click();}catch(err){if(status)status.textContent='Please tap the screenshot button again.';}};
 zone.addEventListener('click',function(e){if(e.target!==input){e.preventDefault();openPicker();}});
 zone.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openPicker();}});
 input.addEventListener('click',e=>e.stopPropagation());
 input.addEventListener('change',async function(e){
   e.stopImmediatePropagation();
   const files=[...e.target.files].filter(f=>f.type.startsWith('image/'));
   if(!files.length)return;
   const list=document.getElementById('uploadList');
   if(list)list.innerHTML=files.map(f=>`<div class="upload-item"><span>${String(f.name).replace(/[&<>"']/g,'')}</span><span>${Math.round(f.size/1024)} KB</span></div>`).join('');
   if(status)status.textContent=`${files.length} screenshot${files.length>1?'s':''} selected. Starting fast OCR…`;
   let worker=null,text='';
   try{
     worker=await Tesseract.createWorker('eng',1,{logger:m=>{if(status&&m.status){const p=typeof m.progress==='number'?` ${Math.round(m.progress*100)}%`:'';status.textContent=`Reading screenshot…${p}`;}}});
     await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1',user_defined_dpi:'200'});
     for(let n=0;n<files.length;n++){
       if(status)status.textContent=`Reading screenshot ${n+1} of ${files.length}…`;
       const r=await worker.recognize(files[n]);
       text+=`\n${r.data.text||''}`;
     }
   }catch(err){
     console.error('Fast OCR failed',err);
     if(status)status.textContent='OCR could not finish. Please enter the teams manually and continue.';
   }finally{if(worker)try{await worker.terminate();}catch(_){} }
   if(!text.trim())return;
   try{
     S.text=text;
     if(typeof detectTeams==='function')detectTeams(text);
     const parsed=window.PredictIQSportyParser?.parse(text);
     S.odds=parsed?.rows||[];
     if(typeof renderOdds==='function')renderOdds();
     if(status)status.textContent=S.home&&S.away?`Detected ${S.home} vs ${S.away}. Please confirm the names.`:'OCR finished. Please enter or correct the team names.';
   }catch(err){console.error('OCR parsing failed',err);if(status)status.textContent='OCR finished. Please enter or correct the team names.';}
 });
 const button=document.getElementById('pickScreenshotBtn');
 if(button)button.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();openPicker();};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
