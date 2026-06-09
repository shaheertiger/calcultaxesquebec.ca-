import zlib, struct, math

def write_png(path, size, maskable=False):
    W = H = size
    # palette
    blue = (0x00, 0x57, 0xA8)
    white = (255, 255, 255)
    green = (0x16, 0x7A, 0x3F)
    bg_radius = 0 if maskable else size*0.22  # maskable = full bleed square
    px = bytearray()
    cx, cy = W/2, H/2
    # checkmark geometry (relative)
    p1 = (W*0.30, H*0.52)
    p2 = (W*0.44, H*0.66)
    p3 = (W*0.72, H*0.36)
    stroke = size*0.075
    def dist_seg(px_, py_, a, b):
        ax, ay = a; bx, by = b
        dx, dy = bx-ax, by-ay
        l2 = dx*dx+dy*dy
        t = max(0, min(1, ((px_-ax)*dx+(py_-ay)*dy)/l2)) if l2 else 0
        projx, projy = ax+t*dx, ay+t*dy
        return math.hypot(px_-projx, py_-projy)
    for y in range(H):
        for x in range(W):
            # rounded corner alpha
            a = 255
            if not maskable and bg_radius > 0:
                rx = min(x, W-1-x); ry = min(y, H-1-y)
                if rx < bg_radius and ry < bg_radius:
                    d = math.hypot(bg_radius-rx, bg_radius-ry)
                    if d > bg_radius:
                        a = 0
                    elif d > bg_radius-1.5:
                        a = int(255*(bg_radius-d+0.5))
                        a = max(0,min(255,a))
            r,g,b = blue
            # checkmark
            dm = min(dist_seg(x,y,p1,p2), dist_seg(x,y,p2,p3))
            if dm < stroke:
                r,g,b = white
            elif dm < stroke+1.5:
                f = (stroke+1.5-dm)/1.5
                r = int(blue[0]*(1-f)+white[0]*f)
                g = int(blue[1]*(1-f)+white[1]*f)
                b = int(blue[2]*(1-f)+white[2]*f)
            px += bytes((r,g,b,a))
    # build png
    raw = bytearray()
    for y in range(H):
        raw.append(0)
        raw += px[y*W*4:(y+1)*W*4]
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        c += struct.pack('>I', zlib.crc32(typ+data) & 0xffffffff)
        return c
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    with open(path,'wb') as f:
        f.write(sig+chunk(b'IHDR',ihdr)+chunk(b'IDAT',idat)+chunk(b'IEND',b''))
    print('wrote', path)

write_png('icons/icon-192.png', 192)
write_png('icons/icon-512.png', 512)
write_png('icons/icon-maskable-512.png', 512, maskable=True)
write_png('icons/apple-touch-icon.png', 180)
write_png('icons/icon-512-og.png', 512)
