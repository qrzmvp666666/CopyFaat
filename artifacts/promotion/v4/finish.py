from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter
from pathlib import Path
r=Path('/Users/qrz/Desktop/SignalFast');o=r/'artifacts/promotion/v4'
im=Image.open(r/'artifacts/promotion/v3/signalfast-green-final-1024.png').convert('RGB')
d=ImageDraw.Draw(im)
font='/System/Library/Fonts/STHeiti Medium.ttc'
def f(n):return ImageFont.truetype(font,n)
def center(text,y,n,color='#ffffff'):
 box=d.textbbox((0,0),text,font=f(n));d.text(((1024-box[2])/2,y),text,font=f(n),fill=color)
a=r/'apps/saas/public/images/hero-floating'
items=[('三马哥','icon-1.png'),('军长','icon-4.png'),('所长','icon-3.png'),('舒琴','onboarding-kol-5.png'),('飞扬','icon-2.png')]
def avatar(cx,cy,size,file):
 d.ellipse((cx-size/2-3,cy-size/2-3,cx+size/2+3,cy+size/2+3),fill='#78ffe0')
 av=ImageOps.fit(Image.open(a/file).convert('RGB'),(size,size),method=Image.Resampling.LANCZOS)
 mask=Image.new('L',(size,size));ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255)
 im.paste(av,(int(cx-size/2),int(cy-size/2)),mask)
# Preserve the original five portrait identities and explicitly show library continuation.
d.rounded_rectangle((79,290,946,365),radius=36,fill='#061716',outline='#39efbd',width=2)
for i,(name,file) in enumerate(items):
 x=104+i*137
 avatar(x+22,326,42,file)
 d.text((x+52,316),name,font=f(22),fill='white')
d.rounded_rectangle((804,301,933,351),radius=23,fill='#20e9af')
d.text((815,316),'+ 更多KOL',font=f(19),fill='#00291e')
# Cover only former plain text labels; keep the underlying original candle chart.
for box in [(250,578,314,605),(417,628,464,657),(546,689,595,718),(635,746,685,775),(692,776,741,804)]:
 d.rounded_rectangle(box,radius=4,fill='#101b1c')
# Photographic avatars are placed on the actual chart with stems to signal points.
markers=[(280,578,280,622,0),(440,627,440,675,1),(570,685,570,735,2),(649,733,662,793,3),(730,775,718,823,4)]
for cx,cy,px,py,i in markers:
 name,file=items[i]
 d.line((cx,cy+27,px,py),fill='#3dffcb',width=2)
 d.ellipse((px-4,py-4,px+4,py+4),fill='#28ffc2')
 avatar(cx,cy,48,file)
 labelw=int(d.textlength(name,font=f(15)))+14
 d.rounded_rectangle((cx-labelw/2,cy+27,cx+labelw/2,cy+47),radius=5,fill='#072b24')
 d.text((cx-labelw/2+7,cy+29),name,font=f(15),fill='#aaffdf')
# Keep the emerald outline, simplify offer copy and state the actual annual offer.
d.rounded_rectangle((32,860,992,997),radius=32,fill='#04211d')
d.rounded_rectangle((114,877,349,907),radius=15,fill='#24edb1')
d.text((131,881),'限时活动价',font=f(23),fill='#00291c')
d.text((370,880),'Pro 年费 US$99.99',font=f(25),fill='#e5fff4')
center('约 1.92 美元 / 周',910,53,'#77ffca')
center('按活动年费折算',970,18,'#c4e1d7')
im.save(o/'signalfast-green-kol-offer-1024.png',optimize=True)
im=im.resize((900,900),Image.Resampling.LANCZOS)
p=o/'signalfast-green-kol-offer-900.jpg';im.save(p,quality=95,subsampling=0,optimize=True)
print(p,p.stat().st_size)
assert p.stat().st_size<720000
