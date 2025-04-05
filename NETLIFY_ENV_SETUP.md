# Add to Netlify Environment Variables

The following environment variables should be added directly in the Netlify dashboard under Site settings > Build & deploy > Environment variables:

- META_APP_SECRET (Add your Facebook app secret - NEVER commit this to your repository)
- VITE_SUPABASE_ANON_KEY (Add your Supabase anon key)
- SUPABASE_SERVICE_KEY (Add your Supabase service role key - needed for serverless functions)

IMPORTANT: Do not add sensitive keys to any files in the repository. Always use the Netlify environment variables for secrets.