"""Gambar mentah di assets-src/ -> WebP 512 px berlatar transparan di src/assets/components/.

Pakai (dari akar proyek):  python scripts/process-assets.py
Perlu Pillow (pip install pillow). Ukuran hasil dicatat di manifest.json agar tampilan tahu
rasio gambar tanpa memuatnya lebih dulu.
"""

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / 'assets-src'
OUT_DIR = ROOT / 'src' / 'assets' / 'components'

SIZE_PX = 512  # sisi terpanjang
WHITE_MIN = 238  # kanal terkecil di atas ini dianggap latar putih
ALPHA_MIN = 8  # di bawah ini dianggap kosong saat memangkas tepi
WEBP_QUALITY = 88

# Berkas mentah -> nama hasil; nama mengikuti field `image` di src/data/catalog/*.json.
# Satu gambar dipakai bersama oleh semua item sejenis.
# `papan trainer.png` (foto papan, tanpa latar untuk dibuang) sengaja tidak diproses.
SOURCES = {
    'Modul surya .png': 'pv-module',
    'SCC PWM .png': 'scc-pwm',
    'SCC MPPT .png': 'scc-mppt',
    'Baterai VRLA .png': 'battery-vrla',
    'Baterai LiFePO4 .png': 'battery-lfp',
    'inverter pure sine wave.png': 'inverter-offgrid',
    'inverter grid tie.png': 'inverter-gridtie',
    'inverter hibrida 5k.png': 'inverter-hybrid',
    'mcb dc 2p.png': 'mcb-dc-2p',
    'mcb ac 1p.png': 'mcb-ac-1p',
    'combiner box_rb.png': 'combiner-pv-2s',
    'kwh meter exim.png': 'kwh-meter-sdm230',
    'lampu LED DC.png': 'load-dc',
    'lampu ac.jpg': 'load-ac',
    'kipas.png': 'load-ac-fan',
    'tv.png': 'load-ac-tv',
    'pompa air kecil _rb.png': 'load-ac-pump',
    'multimeter digital.png': 'instrument-multimeter',
    'tang ampere.png': 'instrument-clamp-meter',
    'solar power meter.png': 'instrument-solar-meter',
}


def remove_white_background(image: Image.Image) -> Image.Image:
    """Membuang putih yang tersambung ke tepi gambar; putih di dalam benda tetap."""
    rgb = image.convert('RGB')
    red, green, blue = rgb.split()
    darkest = ImageChops.darker(ImageChops.darker(red, green), blue)
    white = darkest.point(lambda value: 255 if value >= WHITE_MIN else 0)
    framed = ImageOps.expand(white, border=1, fill=255)
    ImageDraw.floodfill(framed, (0, 0), 128)
    background = framed.crop((1, 1, framed.width - 1, framed.height - 1)).point(
        lambda value: 255 if value == 128 else 0
    )
    # Kikis 1 px lalu haluskan agar tepi putih (halo) tidak ikut.
    alpha = ImageChops.invert(background)
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    result = rgb.convert('RGBA')
    result.putalpha(alpha)
    return result


def process(source: Path, target: Path) -> tuple[int, int]:
    image = Image.open(source)
    has_alpha = image.mode == 'RGBA' and image.getchannel('A').getextrema()[0] < 255
    image = image.convert('RGBA') if has_alpha else remove_white_background(image)
    visible = image.getchannel('A').point(lambda alpha: 255 if alpha > ALPHA_MIN else 0)
    image = image.crop(visible.getbbox())
    image.thumbnail((SIZE_PX, SIZE_PX), Image.LANCZOS)
    image.save(target, 'WEBP', quality=WEBP_QUALITY, method=6)
    return image.size


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for source_name, name in SOURCES.items():
        source = SRC_DIR / source_name
        if not source.exists():
            print(f'LEWATI {source_name}: berkas tidak ada')
            continue
        width, height = process(source, OUT_DIR / f'{name}.webp')
        manifest[name] = {'widthPx': width, 'heightPx': height}
        print(f'{source_name} -> {name}.webp {width}x{height}')
    manifest_path = OUT_DIR / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n', 'utf-8')
    print(f'{len(manifest)} gambar; ukuran dicatat di {manifest_path.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
