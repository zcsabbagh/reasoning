# LinkedIn OAuth Setup Instructions

## Current URLs that need to be added to your LinkedIn App

Based on the current Replit configuration, you need to add these URLs to your LinkedIn Developer Console:

### Development URLs:
- `https://30aba30c-9c88-491e-a23e-76e57f3164b6-00-18ryppe813hfo.riker.replit.dev/auth/linkedin/callback`

### Production URLs:
- `https://workspace.zcsabbagh.repl.co/auth/linkedin/callback`
- `https://test-interaction-site-zcsabbagh.replit.app/auth/linkedin/callback`

## LinkedIn App Configuration Steps:

1. Go to https://www.linkedin.com/developers/apps
2. Select your app: "test-interaction-site"
3. Go to the "Auth" tab
4. In "Authorized redirect URLs for your app", add ALL the URLs above
5. In "OAuth 2.0 scopes", make sure you have:
   - `r_liteprofile` (to read basic profile info)
   - `r_emailaddress` (if you need email - may require verification)

## Troubleshooting:

If you're still getting scope errors:
- Your LinkedIn app may need to be reviewed by LinkedIn for certain scopes
- Try with just `r_liteprofile` scope first
- Make sure your app is set to "Live" mode if you want public access

## Current Issues Detected:
- "unauthorized_scope_error" suggests LinkedIn app doesn't have proper permissions
- Multiple redirect URL mismatches between dev and production environments