"""A renderelt képek körülvágása és képatlaszokba csomagolása (WebP), a játék leírófájljával."""
import json
import os

from PIL import Image

PAD = 8
MAX = 2048


ALPHA_FLOOR = 10


def soften_shadow(img, factor):
    """A talajra vetett árnyék halványítása (factor = 0: az árnyék teljes eltüntetése).

    Az árnyékfogó sík tiszta fekete, részben átlátszó képpontokat ad; a modell képpontjai fedők.
    """
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 236 and r < 18 and g < 18 and b < 18:
                px[x, y] = (r, g, b, round(a * factor))
    return img


def trim(img):
    """A halvány árnyékzaj eltüntetése és az átlátszó szegély levágása.

    Az árnyékfogó sík a kép teljes területén hagy alig látható foltokat; ezek nélkül a kép
    körül a térképen halvány téglalap látszana. Visszaadja a képet és a levágott bal felső sarkot.
    """
    alpha = img.getchannel('A').point(lambda a: 0 if a <= ALPHA_FLOOR else round((a - ALPHA_FLOOR) * 255 / (255 - ALPHA_FLOOR)))
    img.putalpha(alpha)
    bbox = alpha.getbbox()
    if bbox is None:
        return img.crop((0, 0, 1, 1)), (0, 0)
    return img.crop(bbox), (bbox[0], bbox[1])


def _pot(n):
    p = 64
    while p < n:
        p *= 2
    return p


def pack(items, width):
    """Polcos csomagolás: (név, kép) lista -> elhelyezések és a szükséges magasság."""
    placed, x, y, shelf = {}, PAD, PAD, 0
    for name, img in sorted(items, key=lambda it: -it[1].height):
        w, h = img.size
        if x + w + PAD > width:
            x, y, shelf = PAD, y + shelf + PAD, 0
        placed[name] = (x, y)
        x += w + PAD
        shelf = max(shelf, h)
    return placed, y + shelf + PAD


def build(cache_dir, sprites_dir, manifest_path, meta, tilt, k):
    """meta: név -> dict(page, ax, ay, u, ui). A gyorsítótár PNG-iből atlaszlapokat készít."""
    os.makedirs(os.path.join(sprites_dir, 'ui'), exist_ok=True)
    by_page = {}
    for name, info in sorted(meta.items()):
        img = Image.open(os.path.join(cache_dir, f'{name}.png')).convert('RGBA')
        if info.get('ui'):
            # A felületi kép árnyék nélkül készül, hogy a modell töltse ki a képet.
            ui, _ = trim(soften_shadow(img.copy(), 0.0))
            ui.thumbnail((info['ui'], info['ui']), Image.LANCZOS)
            ui.save(os.path.join(sprites_dir, 'ui', f'{name}.webp'), 'WEBP', quality=90, method=6)
        if info.get('shadow', 1.0) < 1.0:
            soften_shadow(img, info['shadow'])
        cut, (ox, oy) = trim(img)
        by_page.setdefault(info['page'], []).append((name, cut))
        info['_anchor'] = (info['ax'] - ox, info['ay'] - oy)

    pages, sprites = [], {}
    for page in sorted(by_page):
        items = by_page[page]
        total = sum((i.width + PAD) * (i.height + PAD) for _, i in items)
        width = 1024 if total < 1024 * 900 else MAX
        placed, height = pack(items, width)
        while height > MAX and width < MAX:
            width = MAX
            placed, height = pack(items, width)
        if height > MAX:
            raise SystemExit(f'A(z) {page} lap nem fér el {MAX}×{MAX} képpontban ({height}).')
        sheet = Image.new('RGBA', (width, _pot(height)), (0, 0, 0, 0))
        for name, img in items:
            x, y = placed[name]
            sheet.paste(img, (x, y))
            ax, ay = meta[name]['_anchor']
            sprites[name] = [len(pages), x, y, img.width, img.height, round(ax, 1), round(ay, 1), round(meta[name]['u'], 2)]
        file = f'{page}.webp'
        sheet.save(os.path.join(sprites_dir, file), 'WEBP', quality=92, method=6)
        pages.append(file)
        print(f'  {file}: {sheet.width}×{sheet.height}, {len(items)} kép, {os.path.getsize(os.path.join(sprites_dir, file)) // 1024} kB')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump({'tilt': tilt, 'k': round(k, 5), 'pages': pages, 'sprites': sprites}, f, separators=(',', ':'), sort_keys=True)
        f.write('\n')
