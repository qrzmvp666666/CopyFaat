from PIL import Image, ImageDraw, ImageFont, ImageOps
from pathlib import Path
root=Path('/Users/qrz/Desktop/SignalFast'); out=root/'artifacts/promotion/v2'
font='/System/Library/Fonts/STHeiti Medium.ttc'
assets=root/'apps/saas/public/images/hero-floating'
avatars=[('所长','icon-3.png'),('舒琴','onboarding-kol-5.png'),('飞扬','icon-2.png'),('三马哥','icon-1.png'),('军长','icon-4.png')]
for f in out.glob('*-master.png'):
 im=Image.open(f).convert('RGB'); w,h=im.size
 d=ImageDraw.Draw(im)
 # Composite actual project KOL images, without redrawing the portraits.
 y=304 if f.name.startswith(("02", "03")) else 342
 d.rounded_rectangle((22,y,1002,y+72),radius=18,fill='#0b1217',outline='#305149',width=1)
 for i,(name,asset) in enumerate(avatars):
  x=36+i*194
  d.rounded_rectangle((x,y+9,x+182,y+63),radius=27,fill='#25272d')
  av=ImageOps.fit(Image.open(assets/asset).convert('RGB'),(44,44),method=Image.Resampling.LANCZOS)
  mask=Image.new('L',(44,44));ImageDraw.Draw(mask).ellipse((0,0,43,43),fill=255)
  im.paste(av,(x+6,y+14),mask)
  d.text((x+58,y+23),name,font=ImageFont.truetype(font,24),fill='white')
 # Replace generated brand lockup using original SF mark and deterministic label.
 brand_x=350 if f.name.startswith(('02','03')) else 40
 d.rounded_rectangle((brand_x-15,16,brand_x+355,82),radius=10,fill='#070d10')
 logo=Image.open(root/'packages/ui/assets/signalfast-logo-mark.png').convert('RGBA');logo=logo.crop(logo.getbbox());logo.thumbnail((64,48),Image.Resampling.LANCZOS)
 im.paste(logo,(brand_x,26),logo)
 d.text((brand_x+74,27),'SignalFast',font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',37),fill='white')
 if f.name.startswith('02'):
  d.rounded_rectangle((274,674,758,819),radius=14,fill='#0d1320')
  for j,(name,asset) in enumerate([avatars[3],avatars[2],avatars[0]]):
   yy=680+j*45
   av=ImageOps.fit(Image.open(assets/asset).convert('RGB'),(32,32),method=Image.Resampling.LANCZOS)
   mask=Image.new('L',(32,32));ImageDraw.Draw(mask).ellipse((0,0,31,31),fill=255)
   im.paste(av,(292,yy),mask)
   d.text((337,yy+5),name+' · 实时信号',font=ImageFont.truetype(font,21),fill='white')
   d.text((597,yy+6),['BTC/USDT','ETH/USDT','SOL/USDT'][j],font=ImageFont.truetype(font,18),fill='#60e4c0')
 im=im.resize((900,900),Image.Resampling.LANCZOS)
 target=out/f.name.replace('-master.png','-900.jpg');im.save(target,quality=95,optimize=True,subsampling=0)
 print(target.name,target.stat().st_size)
 assert target.stat().st_size<720000
