/* PredictIQ verified data-provider adapter.
   Uses football-data.org's free tier when FOOTBALL_DATA_TOKEN is configured server-side.
   Never hard-codes credentials in the browser. */
export async function getTodayFixtures({date, token, competitions=''}) {
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN is not configured');
  const qs=new URLSearchParams({dateFrom:date,dateTo:date,status:'SCHEDULED'});
  if(competitions) qs.set('competitions',competitions);
  const r=await fetch(`https://api.football-data.org/v4/matches?${qs}`,{headers:{'X-Auth-Token':token}});
  if(!r.ok) throw new Error(`Football data provider returned ${r.status}`);
  const data=await r.json();
  return (data.matches||[]).filter(m=>m.utcDate&&new Date(m.utcDate)>new Date()).map(m=>({id:String(m.id),sport:'football',competition:m.competition?.name||'',home:m.homeTeam?.name||'',away:m.awayTeam?.name||'',kickoff:m.utcDate,status:m.status}));
}
