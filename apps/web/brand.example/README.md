# Brand

The dashboard's name, logo, domains and email sender aren't in the repo. They're read at build time from `apps/web/brand.local/`, which is gitignored. Without that folder, the dashboard uses the neutral defaults in this one.

To set up a deployment, copy this folder and edit it:

```bash
cp -r apps/web/brand.example apps/web/brand.local
```

| Field       | What it is                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `name`      | Shown in page titles, emails and the sign-in page                                                |
| `domains`   | Where the dashboard is served. `pnpm web:deploy` attaches them; keep each one behind sign-in     |
| `emailFrom` | Sender of sign-in and invite emails, on a domain verified in Resend                              |
| `logo`      | An SVG file in the same folder. Use `fill="currentColor"` for parts that should follow the theme |
