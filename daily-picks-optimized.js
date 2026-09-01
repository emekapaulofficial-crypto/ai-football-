/* PredictIQ Daily Picks performance patch. Keeps existing analysis logic but deduplicates recent-form requests. */
(function(){'use strict';
const original=window.PredictIQDailyPicks;
if(!original||!window.PredictIQFreeData)return;
const api=window.PredictIQFreeData;
const originalLoad=original.load;
let cache=new Map(),cacheDay='';
async function cached(id,name){const key=String(id||'name:'+name).toLowerCase();if(cacheDay!==new Date().toISOString().slice(0,10)){cache.clear();cacheDay=new Date().toISOString().slice(0,10);}if(cache.has(key))return cache.get(key);let p;if(id&&api.recentMatchesById)p=api.recentMatchesById(id,name,5);else p=api.recentMatches(name,5);cache.set(key,p);return p;}
window.PredictIQDailyPicksCache={get:cached,clear:()=>cache.clear()};
})();
