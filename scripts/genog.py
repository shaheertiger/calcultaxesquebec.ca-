import zlib, struct, math

# 5x7 font (rows top->bottom, bits left->right of 5)
F = {
'A':["01110","10001","10001","11111","10001","10001","10001"],
'B':["11110","10001","11110","10001","10001","10001","11110"],
'C':["01110","10001","10000","10000","10000","10001","01110"],
'E':["11111","10000","11110","10000","10000","10000","11111"],
'G':["01110","10001","10000","10111","10001","10001","01110"],
'L':["10000","10000","10000","10000","10000","10000","11111"],
'O':["01110","10001","10001","10001","10001","10001","01110"],
'P':["11110","10001","10001","11110","10000","10000","10000"],
'Q':["01110","10001","10001","10001","10101","10010","01101"],
'R':["11110","10001","10001","11110","10100","10010","10001"],
'S':["01111","10000","10000","01110","00001","00001","11110"],
'T':["11111","00100","00100","00100","00100","00100","00100"],
'U':["10001","10001","10001","10001","10001","10001","01110"],
'V':["10001","10001","10001","10001","10001","01010","00100"],
'X':["10001","10001","01010","00100","01010","10001","10001"],
'0':["01110","10011","10101","10101","11001","10001","01110"],
'1':["00100","01100","00100","00100","00100","00100","01110"],
"4":["00010","00110","01010","10010","11111","00010","00010"],
'5':["11111","10000","11110","00001","00001","10001","01110"],
'7':["11111","00001","00010","00100","01000","01000","01000"],
'9':["01110","10001","10001","01111","00001","10001","01110"],
'%':["11001","11010","00100","01011","10011","00000","00000"],
',':["00000","00000","00000","00000","00100","00100","01000"],
'.':["00000","00000","00000","00000","00000","01100","01100"],
' ':["00000","00000","00000","00000","00000","00000","00000"],
'-':["00000","00000","00000","11111","00000","00000","00000"],
':':["00000","00100","00100","00000","00100","00100","00000"],
}

W,H = 1200,630
bg=(0x0b,0x2a,0x4a); blue=(0x00,0x57,0xA8); white=(255,255,255); light=(0xCF,0xE0,0xF2); green=(0x3a,0xd6,0x84)
buf=bytearray(W*H*4)
def setpx(x,y,c,a=255):
    if 0<=x<W and 0<=y<H:
        i=(y*W+x)*4
        buf[i]=c[0];buf[i+1]=c[1];buf[i+2]=c[2];buf[i+3]=a
# vertical gradient bg
for y in range(H):
    t=y/H
    c=(int(0x06+ (0x00-0x06)*t), int(0x1c+(0x3a-0x1c)*t), int(0x33+(0x66-0x33)*t))
    for x in range(W):
        i=(y*W+x)*4; buf[i]=c[0];buf[i+1]=c[1];buf[i+2]=c[2];buf[i+3]=255

def text(s,x0,y0,scale,color):
    cx=x0
    for ch in s:
        g=F.get(ch,F[' '])
        for ry,row in enumerate(g):
            for rx,bit in enumerate(row):
                if bit=='1':
                    for dy in range(scale):
                        for dx in range(scale):
                            setpx(cx+rx*scale+dx, y0+ry*scale+dy, color)
        cx += (5+1)*scale
    return cx

# checkmark badge top-left
bx,by,bs=90,90,150
for y in range(by,by+bs):
    for x in range(bx,bx+bs):
        rx=min(x-bx,bx+bs-1-x); ry=min(y-by,by+bs-1-y); r=33
        a=255
        if rx<r and ry<r:
            d=math.hypot(r-rx,r-ry)
            if d>r: a=0
        if a: setpx(x,y,blue,a)
def seg(x,y,a,b):
    ax,ay=a;bx2,by2=b;dx=bx2-ax;dy=by2-ay;l2=dx*dx+dy*dy
    t=max(0,min(1,((x-ax)*dx+(y-ay)*dy)/l2)) if l2 else 0
    return math.hypot(x-(ax+t*dx),y-(ay+t*dy))
p1=(bx+bs*0.28,by+bs*0.52);p2=(bx+bs*0.43,by+bs*0.68);p3=(bx+bs*0.74,by+bs*0.34)
for y in range(by,by+bs):
    for x in range(bx,bx+bs):
        if min(seg(x,y,p1,p2),seg(x,y,p2,p3))< bs*0.06:
            setpx(x,y,white)

text("CALCUL TAXES",90,300,11,white)
text("QUEBEC",90,400,11,light)
# accent bar
for y in range(500,514):
    for x in range(92,92+360):
        setpx(x,y,green)
text("TPS 5%   TVQ 9,975%   TOTAL 14,975%",92,545,5,light)

raw=bytearray()
for y in range(H):
    raw.append(0); raw+=buf[y*W*4:(y+1)*W*4]
def chunk(typ,data):
    return struct.pack('>I',len(data))+typ+data+struct.pack('>I',zlib.crc32(typ+data)&0xffffffff)
with open('icons/og-image.png','wb') as f:
    f.write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',W,H,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b''))
print('wrote og-image.png')
