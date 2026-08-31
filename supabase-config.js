// Public Supabase browser configuration only. Never put a service-role/secret key here.
// Replace these placeholders with your Supabase project URL and publishable key.
window.PredictIQSupabase={url:'YOUR_SUPABASE_URL',publishableKey:'YOUR_SUPABASE_PUBLISHABLE_KEY',client:null};
if(window.supabase&&window.PredictIQSupabase.url.startsWith('http')&&!window.PredictIQSupabase.publishableKey.startsWith('YOUR_')){window.PredictIQSupabase.client=window.supabase.createClient(window.PredictIQSupabase.url,window.PredictIQSupabase.publishableKey);}
