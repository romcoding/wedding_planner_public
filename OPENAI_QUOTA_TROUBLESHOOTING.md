# OpenAI API Quota Troubleshooting Guide

## Problem: "insufficient_quota" Error

If you're seeing `insufficient_quota` errors but no token usage in your OpenAI dashboard, here are the most common causes:

### 1. **No Payment Method Added**
- **Issue**: OpenAI requires a payment method even for free tier usage
- **Solution**: 
  - Go to https://platform.openai.com/account/billing
  - Add a payment method (credit card)
  - Even if you have free credits, a payment method is required

### 2. **API Key Issues**
- **Check**: Verify the API key in Render environment variables matches your OpenAI account
- **Solution**:
  - Go to https://platform.openai.com/api-keys
  - Create a new API key if needed
  - Update `OPENAI_API_KEY` in Render environment variables
  - Ensure the key starts with `sk-` and is the correct length

### 3. **Account Credits Depleted**
- **Check**: Go to https://platform.openai.com/usage
- **Solution**: 
  - Add credits to your account
  - Set up billing limits if needed
  - Check usage history to see if tokens were actually used

### 4. **Organization vs Personal Account**
- **Issue**: API key might be from a different organization
- **Solution**: 
  - Check which organization the API key belongs to
  - Ensure you're checking the correct dashboard

### 5. **Rate Limits vs Quota**
- **Rate Limit**: Too many requests per minute (429 with different error)
- **Quota**: No credits/balance available (429 with `insufficient_quota`)
- **Solution**: Check the exact error message in logs

## Debugging Steps

1. **Check API Key Configuration**:
   ```bash
   # In Render shell, check if key is set
   echo $OPENAI_API_KEY | head -c 20
   ```

2. **Verify API Key in OpenAI Dashboard**:
   - Go to https://platform.openai.com/api-keys
   - Check if the key exists and is active
   - Check last used date

3. **Check Usage Dashboard**:
   - Go to https://platform.openai.com/usage
   - Look for any token usage
   - Check billing period

4. **Test API Key Directly**:
   ```python
   import openai
   client = openai.OpenAI(api_key="your-key-here")
   response = client.chat.completions.create(
       model="gpt-4o-mini",
       messages=[{"role": "user", "content": "Hello"}]
   )
   print(response.usage)
   ```

5. **Check Render Logs**:
   - Look for API key length and prefix in logs
   - Check for specific error messages
   - Verify model names are correct

## Common Solutions

### Solution 1: Add Payment Method
1. Go to https://platform.openai.com/account/billing
2. Click "Add payment method"
3. Enter credit card details
4. Wait a few minutes for activation

### Solution 2: Verify API Key
1. Go to https://platform.openai.com/api-keys
2. Create a new key if needed
3. Copy the key (starts with `sk-`)
4. Update in Render: Environment → `OPENAI_API_KEY`
5. Redeploy the service

### Solution 3: Check Account Status
1. Go to https://platform.openai.com/account
2. Check account status
3. Verify billing is set up
4. Check for any account restrictions

## Why No Tokens Show in Dashboard

If you see quota errors but no token usage:

1. **API calls are failing before tokens are consumed**
   - The error happens during authentication/authorization
   - No tokens are charged for failed requests

2. **Wrong API key**
   - Key belongs to different account
   - Check which account the key is associated with

3. **Dashboard delay**
   - Usage can take a few minutes to appear
   - Check again after 5-10 minutes

4. **Different organization**
   - API key might be from organization account
   - Check organization settings

## Prevention

1. **Set up billing alerts** in OpenAI dashboard
2. **Monitor usage** regularly
3. **Use rate limiting** in your code
4. **Implement fallback** for quota errors
5. **Log API calls** for debugging

## Next Steps

After fixing the issue:
1. Test with a simple API call
2. Check logs for successful token usage
3. Verify tokens appear in dashboard
4. Monitor for any recurring issues
