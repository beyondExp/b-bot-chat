# Environment Variables Setup

This document describes the required environment variables for the B-Bot Chat Application.

## Required Environment Variables

### API Endpoints

#### `LANGGRAPH_API_URL`
- **Purpose**: Direct LangGraph/Synapse service endpoint
- **Used for**: Streaming requests, thread creation, history requests
- **Example**: `https://b-bot-synapse-7da200fd4cf05d3d8cc7f6262aaa05ee.eu.langgraph.app`
- **Default**: `https://b-bot-synapse-7da200fd4cf05d3d8cc7f6262aaa05ee.eu.langgraph.app`

#### `MAIN_API_URL`
- **Purpose**: MainAPI service endpoint (backend API)
- **Used for**: Assistant queries, proxied LangGraph requests through MainAPI
- **Example**: `https://api.b-bot.space/api`
- **Default**: `https://api.b-bot.space/api`
- **Note**: This is **separate** from LANGGRAPH_API_URL

### Authentication

#### `ADMIN_API_KEY`
- **Purpose**: Admin API key for embed mode and anonymous users
- **Used for**: Server-side authentication for embed-proxy requests
- **Example**: `your-super-secret-admin-key`
- **Default**: `your-super-secret-admin-key`
- **Important**: Should match the ADMIN_API_KEY in your MainAPI/Synapse configuration

#### Auth0 Configuration (for authenticated users)

- `NEXT_PUBLIC_AUTH0_DOMAIN`: Your Auth0 domain (e.g., `your-domain.auth0.com`)
- `NEXT_PUBLIC_AUTH0_CLIENT_ID`: Your Auth0 client ID
- `NEXT_PUBLIC_AUTH0_AUDIENCE`: Your API audience URL
- `NEXT_PUBLIC_SYNAPSE_URL`: Synapse URL for Auth0 audience (default: `http://localhost:2024`)

### Payments

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key

## Configuration Guide

### Local Development

Create a `.env.local` file in the root of the b-bot-chat directory:

```env
LANGGRAPH_API_URL=http://localhost:2024
MAIN_API_URL=http://localhost:8000/api
ADMIN_API_KEY=your-super-secret-admin-key
```

### Production Deployment

Set these environment variables in your deployment platform (Vercel, Docker, etc.):

```env
LANGGRAPH_API_URL=https://your-synapse-deployment.app
MAIN_API_URL=https://your-mainapi-deployment.app/api
ADMIN_API_KEY=your-actual-admin-key
NEXT_PUBLIC_AUTH0_DOMAIN=your-auth0-domain.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-auth0-client-id
NEXT_PUBLIC_AUTH0_AUDIENCE=https://your-api-audience
```

## Important Notes

1. **Separate Services**: `LANGGRAPH_API_URL` and `MAIN_API_URL` point to different services
   - LANGGRAPH_API_URL → LangGraph deployment (Synapse)
   - MAIN_API_URL → Your backend API (MainAPI)

2. **Embed Proxy Routing**:
   - Direct streaming, thread creation, history → Uses `LANGGRAPH_API_URL`
   - Assistant queries, other API calls → Uses `MAIN_API_URL`

3. **Security**: Never commit `.env.local` or `.env` files to version control

## Troubleshooting

### 404 Errors for Embed Requests

If you see 404 errors in the logs for embed requests:

1. Verify `MAIN_API_URL` is set correctly and points to your MainAPI service
2. Ensure `LANGGRAPH_API_URL` points to your LangGraph/Synapse deployment
3. Check that both services are running and accessible

### Authentication Errors

If authentication fails:

1. Verify `ADMIN_API_KEY` matches across all services
2. Check Auth0 configuration if using authenticated users
3. Ensure the API key has proper permissions

## Recent Changes

**2025-12-04**: Separated `LANGGRAPH_API_URL` and `MAIN_API_URL` to fix 404 errors in embed-proxy. Previously, `LANGGRAPH_API_URL` was incorrectly used for both services.



