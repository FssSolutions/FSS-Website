#!/usr/bin/env python3
"""
Makes small, fast WebP copies of the site's photos (name.w750.webp, name.w1500.webp).
The build uses them automatically (srcset), so phones download ~5-10x less.

    pip install pillow
    python3 tools/optimize_images.py          # from the website/ folder

Safe to re-run: existing copies are skipped. Photos uploaded through the online
editor are already resized in the browser; run this now and then to add WebP
copies for them too, then commit the new files.
"""
import os, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDERS = ['assets/images', 'assets/uploads']
WIDTHS = [750, 1500]
LOGO_WIDTHS = [300]

def main():
    made = 0
    for folder in FOLDERS:
        d = os.path.join(ROOT, folder)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            base, ext = os.path.splitext(name)
            if ext.lower() not in ('.jpg', '.jpeg', '.png') or '.w' in base:
                continue
            src = os.path.join(d, name)
            im = ImageOps.exif_transpose(Image.open(src))
            widths = LOGO_WIDTHS if base.startswith('logo') else WIDTHS
            for w in widths:
                out = os.path.join(d, f'{base}.w{w}.webp')
                if os.path.exists(out) or (w > im.width and w != widths[0]):
                    continue
                copy = im.copy()
                if copy.width > w:
                    copy = copy.resize((w, round(copy.height * w / copy.width)), Image.LANCZOS)
                copy.save(out, 'WEBP', quality=78, method=6)
                made += 1
                print(f'{folder}/{name} -> {os.path.basename(out)} ({os.path.getsize(out)//1024} KB)')
    print(f'{made} new image(s)')

if __name__ == '__main__':
    sys.exit(main())
