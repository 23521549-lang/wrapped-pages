# Generate tiny HEIC/AVIF fixtures. Pattern: 120x80, horizontal red->blue gradient,
# green 20x20 marker at top-left (to detect rotation), white 10x10 at bottom-right.
import sys
from PIL import Image, features
import pillow_heif
pillow_heif.register_heif_opener()

W, H = 120, 80
def pattern():
    im = Image.new("RGB", (W, H))
    px = im.load()
    for x in range(W):
        for y in range(H):
            t = x / (W - 1)
            px[x, y] = (int(255 * (1 - t)), 40, int(255 * t))
    for x in range(20):
        for y in range(20):
            px[x, y] = (0, 200, 0)
    for x in range(W - 10, W):
        for y in range(H - 10, H):
            px[x, y] = (255, 255, 255)
    return im

im = pattern()
im.save("fixtures/plain.png")
im.save("fixtures/plain.heic", format="HEIF", quality=50)

exif = Image.Exif()
exif[0x0112] = 6  # Orientation = Rotate 90 CW
im.save("fixtures/orient6.heic", format="HEIF", quality=50, exif=exif.tobytes())

print("pillow avif feature:", features.check("avif"))
try:
    im.save("fixtures/plain.avif", format="AVIF", quality=50)
    print("avif ok")
except Exception as e:
    print("avif failed:", e)
