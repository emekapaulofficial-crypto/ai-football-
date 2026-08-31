// Public Supabase browser configuration. The publishable/anon key is safe for browser use when RLS and authorization are configured correctly.
// Never put a Supabase service-role key in this file.
window.PredictIQSupabase={url:'https://eavamfsbasjvngeqsyua.supabase.co',publishableKey:'sb_publishable_E40QKzlb3dtIoawvmxPHfA_07t2XIxu',client:null};
if(window.supabase&&window.PredictIQSupabase.url.startsWith('http')&&!window.PredictIQSupabase.publishableKey.startsWith('YOUR_')){window.PredictIQSupabase.client=window.supabase.createClient(window.PredictIQSupabase.url,window.PredictIQSupabase.publishableKey);}
