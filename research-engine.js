/* PredictIQ AI — Research & Explanation Layer v1
 * Produces auditable match reasons from verified inputs already returned by the data layer.
 * Never invents injuries, H2H, xG-provider data or news that the feed did not supply.
 */
(function(){'use strict';
function build(home,away,model){
 const factors=Array.isArray(model?.factors)?model.factors.slice():[];
 const h=model?.home||{},a=model?.away||{};
 const winner=model?.prediction?.winner||'Draw';
 const best=model?.prediction?.probability||0;
 const total=model?.xg?.total||0;
 const totalPick=Object.entries(model?.ou||{}).map(([line,q])=>({line:Number(line),over:q.over,under:q.under})).sort((x,y)=>Math.max(y.over,y.under)-Math.max(x.over,x.under))[0];
 const keyPoints=[
  `Recent form: ${h.team||home} ${Number(h.form||0).toFixed(0)}/100 vs ${a.team||away} ${Number(a.form||0).toFixed(0)}/100.`,
  `Attack: ${h.team||home} ${Number(h.attack||0).toFixed(0)}/100 vs ${a.team||away} ${Number(a.attack||0).toFixed(0)}/100.`,
  `Defence: ${h.team||home} ${Number(h.defence||0).toFixed(0)}/100 vs ${a.team||away} ${Number(a.defence||0).toFixed(0)}/100.`,
  `Expected goals: ${(model?.xg?.home||0).toFixed(2)}–${(model?.xg?.away||0).toFixed(2)}; total ${total.toFixed(2)}.`,
  `Data coverage: ${model?.dataConfidence||0}% of the required last-five-match sample.`
 ];
 const warnings=[];
 if((model?.dataConfidence||0)<100)warnings.push('The model has incomplete recent-form coverage, so confidence is reduced.');
 warnings.push('Injuries, suspensions, confirmed line-ups, tactical news and live market movement are only used when a connected data source supplies them.');
 return {winner,best,keyPoints,factors,totalPick,warnings,engineStack:['Recency-weighted form','Attack/defence strength','Venue split when available','Poisson score distribution','Over/Under + BTTS + Double Chance derived from score matrix','Optional Elo/context signals when supplied','Calibration/backtesting layer planned for later versions']};
}
window.PredictIQResearch={build};
})();
