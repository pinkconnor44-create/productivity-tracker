# Calendar hero image

Drop a landscape photograph here as **`calendar.jpg`** (or change `HERO_SRC` in
`src/components/CalendarHorizon.tsx` if you prefer `.webp`).

The component grades it in code — `saturate(0.62) brightness(0.5)` plus a dark
scrim and a violet soft-light cast — so it does NOT need to be pre-edited. Give
it the raw image and let the code do the colour work; that way the grade stays
consistent if the photo is ever swapped.

What works:
- Wide, atmospheric, low-detail. Misty mountains, ridgelines, dunes, coastline.
- Dark or twilight originals. A bright midday photo fights the scrim.
- Detail concentrated in the LOWER half — the top is where the header and the
  orrery sit, so it wants to be quiet sky.

What to avoid:
- Busy foregrounds or anything with text/people; the calendar grid sits on top.
- Anything warm and saturated. It will clash with Electric Iris even graded.

Size and format:
- Export ~2000px wide, then convert to WebP or AVIF at quality ~72.
- Target under ~200 KB. This is a PWA that opens on mobile data, and the
  Website Scraper research measured photography at ~94% of page weight on a
  comparable build — the image is the only page-weight lever that matters.

Licensing is on you — pick something you own or that is properly licensed.
Unsplash and Pexels both have suitable free-license alpine/mist shots.
