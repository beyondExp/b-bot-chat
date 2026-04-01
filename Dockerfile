FROM node:20-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
  && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY package.json ./
COPY . .

# Next.js bakes NEXT_PUBLIC_* variables at build time. Allow providing them via build args.
ARG NEXT_PUBLIC_AUTH_PROVIDER=zitadel
ARG NEXT_PUBLIC_ZITADEL_AUTHORITY=https://idp.beyond-bot.ch
ARG NEXT_PUBLIC_ZITADEL_CLIENT_ID=363202201499207860
ARG NEXT_PUBLIC_ZITADEL_SCOPES="openid profile email"
ARG NEXT_PUBLIC_ZITADEL_RESOURCE
ARG NEXT_PUBLIC_AUTH0_DOMAIN
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID
ARG NEXT_PUBLIC_AUTH0_AUDIENCE
ARG NEXT_PUBLIC_SYNAPSE_URL

ENV NEXT_PUBLIC_AUTH_PROVIDER=${NEXT_PUBLIC_AUTH_PROVIDER}
ENV NEXT_PUBLIC_ZITADEL_AUTHORITY=${NEXT_PUBLIC_ZITADEL_AUTHORITY}
ENV NEXT_PUBLIC_ZITADEL_CLIENT_ID=${NEXT_PUBLIC_ZITADEL_CLIENT_ID}
ENV NEXT_PUBLIC_ZITADEL_SCOPES=${NEXT_PUBLIC_ZITADEL_SCOPES}
ENV NEXT_PUBLIC_ZITADEL_RESOURCE=${NEXT_PUBLIC_ZITADEL_RESOURCE}
ENV NEXT_PUBLIC_AUTH0_DOMAIN=${NEXT_PUBLIC_AUTH0_DOMAIN}
ENV NEXT_PUBLIC_AUTH0_CLIENT_ID=${NEXT_PUBLIC_AUTH0_CLIENT_ID}
ENV NEXT_PUBLIC_AUTH0_AUDIENCE=${NEXT_PUBLIC_AUTH0_AUDIENCE}
ENV NEXT_PUBLIC_SYNAPSE_URL=${NEXT_PUBLIC_SYNAPSE_URL}

RUN corepack enable \
  && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# OpenShift runs the container with an arbitrary UID; make /app writable for that UID's group (0).
RUN chgrp -R 0 /app && chmod -R g=u /app

EXPOSE 8080
CMD ["node_modules/.bin/next", "start", "-p", "8080"]
