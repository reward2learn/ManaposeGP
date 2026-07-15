---
name: blog-management
description: Blog post creation, editing, draft/publishing, image handling, and content extraction. Use for /blog/create, /admin/blog, /config/automation blog features, Instagram scraping, and content pasting.
---

# Blog Management Skill

Complete blog post lifecycle: creation, editing, publishing, draft management, content scraping, and AI indexing.

## Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `/blog` | public | Published posts listing |
| `/blog/[slug]` | public | Single post view |
| `/blog/create` | pin | URL-based post creation |
| `/admin/blog` | pin | Admin blog management (CRUD) |
| `/api/blog` | public | List published posts |
| `/api/blog/create` | pin | Scrape URL + create post |
| `/api/blog/admin` | pin | List all (incl drafts), edit, publish |
| `/api/config/automation?action=paste-content` | pin | Create from pasted content |
| `/api/config/automation?action=scrape-url` | pin | Scrape Instagram or article URL |
| `/api/cron/instagram` | pin/scheduled | Automated Instagram scraping |

## Draft/Published Flow

| Source | Default | Visible Public | AI Indexed |
|--------|---------|---------------|------------|
| `/blog/create` (URL scrape) | published | ✅ | ✅ |
| Instagram cron | published | ✅ | ✅ |
| `/config/automation` scrape | **draft** | ❌ | ✅ |
| `/config/automation` paste | **draft** | ❌ | ✅ |

Toggle publish/draft in `/admin/blog` by clicking the status chip.

## Image Support

Three image fields on `blog_posts`:

| Field | Type | Purpose |
|-------|------|---------|
| `image_url` | TEXT | Card thumbnail + blog header image |
| `section_images` | JSONB | Array of `{src, alt, caption}` for body sections |
| Extracted `<img>` tags | HTML→JSONB | Auto-captured from scraped/pasted HTML |

Set via admin blog editor or during post creation.

## Blog Service Functions

- `createBlogPost({ scraped, enhanced, published, imageUrl, sectionImages })` — create with images and status
- `updateBlogPost(id, data)` — edit any field; re-indexes if content changes
- `listBlogPosts(limit, offset)` — published only
- `listAllBlogPosts(limit, offset)` — all posts for admin
- `getBlogPostBySlug(slug)` — published only (public)
- `getBlogPostById(id)` — any status (admin + AI)
- `findPostBySourceUrl(url)` — duplicate check
- `ensureBlogPostColumns(db)` — adds `section_images` column

## Content Extraction Methods

| Method | API | Best For |
|--------|-----|----------|
| URL scrape | `scrapeUrl(url)` — cheerio-based | Public health articles (Jean Hailes, RACGP) |
| Instagram oEmbed | `scrapeInstagramPostUrl(url)` | Single Instagram posts |
| Instagram profile | `scrapeInstagramProfile(username)` | Bulk profile scraping |
| Paste content | `?action=paste-content` | Blocked/paywalled sites, manual paste |

## AI Integration

- Blog posts indexed into `blog_embeddings` via `indexBlogPost()`
- AI chat uses `search_blog_knowledge` tool → `searchKnowledgeBase()` → `rag-service.ts`
- Re-indexed automatically on content edit
- Drafts ARE searchable by AI (hidden from public only)
