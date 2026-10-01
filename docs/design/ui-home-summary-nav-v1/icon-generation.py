from PIL import Image,ImageDraw
from pathlib import Path
p=Path('/Users/aaron/Documents/huangqiao-app/miniprogram/miniprogram/assets/tab-icons')
def icon(kind,color):
 im=Image.new('RGBA',(128,128));d=ImageDraw.Draw(im)
 if kind=='home':
  d.polygon([(12,57),(64,14),(116,57),(106,70),(100,65),(100,112),(76,112),(76,80),(52,80),(52,112),(28,112),(28,65),(22,70)],fill=color)
 elif kind=='gift':
  d.rounded_rectangle((20,56,108,111),radius=5,fill=color);d.rounded_rectangle((13,43,115,60),radius=4,fill=color);d.rectangle((59,43,69,112),fill=(0,0,0,0));d.ellipse((27,13,65,44),outline=color,width=8);d.ellipse((63,13,101,44),outline=color,width=8)
 elif kind=='study':
  d.polygon([(7,46),(64,20),(121,46),(64,72)],fill=color);d.polygon([(30,68),(64,82),(98,68),(98,95),(64,111),(30,95)],fill=color);d.line([(114,47),(114,93)],fill=color,width=7)
 elif kind=='mine':
  d.ellipse((42,12,86,56),fill=color);d.rounded_rectangle((20,68,108,115),radius=23,fill=color)
 elif kind=='group':
  for x,y,r in [(64,27,18),(26,39,14),(102,39,14)]:d.ellipse((x-r,y-r,x+r,y+r),fill=color)
  for box in [(7,59,43,104),(85,59,121,104),(40,52,88,113)]:d.rounded_rectangle(box,radius=13,fill=color)
 else:
  d.ellipse((41,64,87,119),fill=color);d.ellipse((47,46,81,83),fill=color);d.rectangle((59,12,69,75),fill=color);d.ellipse((55,7,73,23),fill=color);d.line([(79,15),(103,113)],fill=color,width=6)
  im=im.rotate(-27,resample=Image.Resampling.BICUBIC)
 return im.resize((64,64),Image.Resampling.LANCZOS)
for kind in ['home','instrument','gift','study','mine','group']:
 for tone,color in [('muted','#8A7C69'),('active','#4B3325'),('gold','#E2C88F')]:
  icon(kind,color).save(p/f'{kind}-{tone}.png')
