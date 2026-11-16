# FSS Solutions website

The fsssolutions.ca website, with a built-in **drag & drop editor** that also works on a phone.
It doesn't need Squarespace or any monthly fees. It's hosted free on **Cloudflare Pages**, and the content is stored in this GitHub repository.

```
You edit at fsssolutions.ca/editor ──Publish──▶ GitHub (content.json + photos)
                                                   │ automatic
                                                   ▼
                                Cloudflare rebuilds and publishes fsssolutions.ca (~1 minute)
```

---

## One-time setup (about 30 minutes, can be done on a phone)

Do the steps in order. The old Squarespace site keeps working until step 5.

### 1. The website is on the `main` branch
Cloudflare publishes the `main` branch, where the `website/` folder already is. Nothing to do here.

### 2. Create a GitHub access key for the editor
The editor uses this key to save your changes to GitHub.

1. On github.com go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Name:** `fsssolutions website editor`. **Expiration:** 1 year, and put a reminder in your calendar to renew it.
3. **Resource owner:** `fsssolutions`. **Repository access:** *Only select repositories* → `FSS-Website`.
4. **Permissions → Repository permissions → Contents:** *Read and write*.
5. Generate it and copy the key (it starts with `github_pat_`). You only see it once.
   *If GitHub says the token needs approval, approve it under the fsssolutions organization's Settings → Personal access tokens.*

### 3. Create the site on Cloudflare
1. Make a free account at [dash.cloudflare.com](https://dash.cloudflare.com).
2. Go to **Workers & Pages → Create → Pages → Connect to Git**. Allow access to GitHub and pick the `fsssolutions/FSS-Website` repository.
3. Build settings:
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** `node build.js`
   - **Build output directory:** `dist`
   - **Root directory (Advanced):** `website`
4. Press **Save and Deploy**. After a minute your site is live at an address like `fsssolutions.pages.dev`. Check it.
5. Go to the project's **Settings → Variables and Secrets** and add two variables, both of type **Secret**:
   - `EDITOR_PASSWORD`: a long password you'll use to sign in to the editor (e.g. four random words).
   - `GITHUB_TOKEN`: the key from step 2.
6. Go to **Deployments**, open the latest one, choose **Retry deployment** so the secrets take effect, then open `https://<your-project>.pages.dev/editor/` and sign in.

### 4. Move the domain's DNS to Cloudflare (keeps your email working)
Your domain is registered at **GoDaddy**. Its DNS currently points to Squarespace, and your email (Riley@fsssolutions.ca) is Microsoft 365 through GoDaddy.

1. In Cloudflare: **Add a domain** → `fsssolutions.ca` → **Free** plan. Cloudflare copies the existing DNS records.
2. On the DNS records page, **delete** the four `A` records for `fsssolutions.ca` (198.185.159.x / 198.49.23.x) and the `www` CNAME to `ext-sq.squarespace.com`. Those are Squarespace.
3. **Make sure these email records are there**, adding any that are missing. They must stay exactly like this, with the proxy (orange cloud) **off** where the option exists:

   | Type | Name | Content |
   |---|---|---|
   | MX | `@` | `fsssolutions-ca.mail.protection.outlook.com` (priority 0) |
   | TXT | `@` | `NETORG17802213.onmicrosoft.com` |
   | TXT | `@` | `v=spf1 include:secureserver.net -all` |

   Also check your GoDaddy DNS page or Microsoft 365 admin for any other email records (for example `autodiscover`) and copy them over too.
4. Cloudflare gives you two nameservers (like `xxx.ns.cloudflare.com`). In **GoDaddy → My Products → fsssolutions.ca → DNS → Nameservers → Change → "I'll use my own nameservers"**, enter those two.
   *If GoDaddy shows the domain as connected to Squarespace, disconnect it in Squarespace (Settings → Domains) first.*
5. Wait until Cloudflare shows the domain as **Active**. This usually takes under an hour, at most 24 hours. Send yourself a test email to check that mail still works.

### 5. Connect the domain to the site
1. In the Pages project: **Custom domains → Set up a custom domain** → `fsssolutions.ca`, then again for `www.fsssolutions.ca`.
2. Visit https://fsssolutions.ca and https://www.fsssolutions.ca. Both should show the new site with a padlock.

### 6. Cancel Squarespace
After the new site has been working on your domain for a day or two, cancel the Squarespace **website** subscription. Keep the domain renewing at **GoDaddy**.

> ⚠️ **The domain fsssolutions.ca expires on 22 November 2026.** Make sure it renews at GoDaddy (turn on auto-renew), otherwise the website *and* your email stop working.

---

## Editing the site

Go to **https://fsssolutions.ca/editor** (on your phone you can *Share → Add to Home Screen*) and sign in with your editor password.

| To do this | Do this |
|---|---|
| Change any text | Tap or click it and type. Select words for **bold**, *italic*, or a link. |
| Add a block or section | Computer: drag it from the left panel onto the page. Phone: tap **＋ Add**, then tap it. It's added after the selected item. |
| Move things | Drag the **⠿** handle, or use the ↑ ↓ buttons on the selected item. |
| Replace a photo | Drag a photo onto it, or double-click/tap it. You can also select it, then **Settings → Change…**. On a phone you can pick from your camera roll. |
| Colours, columns, background photo | Select the section → right panel (phone: **⚙ Settings**). |
| Logo, menu, fonts, site colours | **Site** tab |
| Pages, page addresses, Google description | **Page** tab, or the page menu at the top |
| Undo / redo | Arrow buttons at the top, or Ctrl+Z / Ctrl+Shift+Z |

Press **Publish** when you're done. The live site updates about a minute later. Large phone photos are shrunk automatically.

Every Publish is saved in GitHub history, so any earlier version can be brought back.

### Showing up on Google and AI assistants
- **Page tab → Google title / Search engine description:** the link text and summary Google shows. Say what you do + where.
- **Heading type:** each page should have exactly one *Main page heading*. The Page tab warns you if not.
- **Site tab → For Google & AI assistants:** your services and service areas, added invisibly to every page. Keep them the same as your Google Business Profile.
- **Photo descriptions:** select a photo and fill in *Description*. Google and AI read these. Say what it shows ("White shaker vanity with quartz top").
- Renaming or deleting a page automatically redirects its old address, so Google rankings aren't lost.
- *Faster photos (optional):* `python3 tools/optimize_images.py` makes small WebP copies of new photos; commit them and the site uses them automatically.

### Contact form
Right now, **Submit** opens the visitor's email app with their message filled in. To get submissions sent straight to your inbox, make a free form at [formspree.io](https://formspree.io). In the editor, click the form and paste its address into **Form service address**.

---

## Working on a computer without internet (optional)

```bash
cd website
node server.js          # http://localhost:8080/editor   (no password)
```

This saves to this folder instead of GitHub. Commit and push the changes yourself afterwards. Run `node build.js` to build `dist/` by hand.

## Files

```
website/
  content.json        ← all site content (the editor edits this)
  editor.html         ← the editor (published at /editor/)
  functions/api/      ← online editor API on Cloudflare (sign-in, load, publish)
  cloud/github.js     ← saves to GitHub for the online editor
  server.js           ← local editing server (same API, saves to disk)
  build.js            ← builds dist/ from content.json
  js/render.js        ← turns content.json into HTML (used everywhere)
  js/editor.js        ← editor logic
  js/site.js          ← mobile menu, form and photo lightbox on the live site
  css/site.css        ← site design
  css/editor.css      ← editor design
  assets/images/      ← photos and logo; new uploads go to assets/uploads/
```

**Security:** the editor page is public, but nothing can be changed without the editor password, and wrong passwords are slowed down. Use a long password. You can change it any time in Cloudflare, then use **Retry deployment**.
