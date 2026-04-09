# Social Media Manager

Full-stack Node.js + React + MySQL project for planning AI-assisted social media content and auto-publishing it to Facebook, Instagram, and YouTube.

## Features

- Manage keyword pools stored in MySQL
- Create scheduled publishing jobs for:
  - text or image posts for Facebook and Instagram
  - short AI-generated videos on alternate dates
  - mirrored YouTube Shorts publishing
- Background scheduler that picks due jobs and processes them automatically
- Safe mock publishers for local development
- React admin dashboard for keywords, jobs, stats, and platform connection status

## Project structure

- `server`: Express + TypeScript API, scheduler, MySQL integration
- `client`: React + Vite dashboard
- `db/schema.sql`: MySQL schema and seed inserts

## Local setup

1. Create a MySQL database named `social_media_manager`.
2. Run the SQL in `db/schema.sql`.
3. Copy `server/.env.example` to `server/.env`.
4. Install dependencies:

```bash
npm run install:all
```

5. Start the backend:

```bash
npm run dev
```

6. In another terminal, start the frontend:

```bash
npm run dev:client
```

## Important note

The external integrations now call real platform APIs, but live posting still requires valid credentials and approved apps for:

- Meta Graph API for Facebook/Instagram
- YouTube Data API with OAuth upload scope
- Your chosen AI providers for text, images, and video generation

AI generation still falls back to mock mode unless you plug in a real provider. Publishing no longer uses mock platform IDs.

## Real publishing setup

### OAuth connect flow

- The dashboard now has `Connect Meta` and `Connect YouTube` buttons.
- Meta OAuth callback route: `http://localhost:4000/api/oauth/meta/callback`
- Google OAuth callback route: `http://localhost:4000/api/oauth/google/callback`
- Add those exact URLs to your Meta and Google app settings.
- Run the updated SQL so the `oauth_states` table exists before testing OAuth.

### Facebook

- Store a Page access token in the platform connection form.
- Store the Facebook Page ID in `pageId`.
- Text posts publish to `/{page-id}/feed`.
- Image posts publish to `/{page-id}/photos`.
- Video posts publish to `/{page-id}/videos`.

### Instagram

- Store an Instagram Business or Creator access token in the platform connection form.
- Store the Instagram Business Account ID in `pageId`.
- Image posts create a media container and then publish it.
- Video posts publish as Reels.
- Text-only Instagram publishing is not supported by the Instagram Content Publishing API, so Instagram targets on `text` jobs will fail.

### YouTube

- Store an OAuth access token in the platform connection form.
- Store a refresh token as well if you want the backend to renew expired access automatically.
- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `server/.env` if using refresh tokens.
- The backend uploads videos with the YouTube Data API resumable upload flow.
- `YOUTUBE_API_KEY` alone is not enough for uploads.

## Current limitations

- The app expects generated image and video assets to be reachable by URL.
- For large video uploads, production systems should add persistent upload retry logic and chunk-resume tracking.
- Meta token refresh is not automated in this MVP. In practice, you should use long-lived Page tokens or add a full Meta OAuth refresh flow.
