import sys,math,subprocess
from pathlib import Path
sys.path.insert(0,str(Path('evidence/video-tools').resolve()))
import imageio_ffmpeg
from PIL import Image,ImageDraw,ImageFont
W,H,FPS,DURATION=960,540,24,12
paper=(245,246,242);ink=(24,59,60);muted=(91,110,107)
font=lambda size:ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',size)
serif=lambda size:ImageFont.truetype('C:/Windows/Fonts/georgia.ttf',size)
clamp=lambda v:max(0,min(1,v))
ease=lambda v:1-(1-clamp(v))**3
out=Path('public/studio-motion');cmd=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'solborne-film.mp4')]
proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
for i in range(FPS*DURATION):
 t=i/FPS;im=Image.new('RGB',(W,H),paper);d=ImageDraw.Draw(im);d.text((55,34),'Solborne & Co.',font=serif(24),fill=ink)
 if t<4:
  d.text((55,170),'Your story.',font=font(65),fill=ink);d.text((58,258),'What you do. Who you help. What makes you, you.',font=font(21),fill=muted)
  for j,txt in enumerate(['Our work','Our customers','Our character']):
   a=ease((t-j*.4)/1.2);x=int(600+(1-a)*130);y=130+j*99
   d.rounded_rectangle((x,y,x+290,y+75),radius=12,fill=(228,235,223),outline=(198,211,191));d.text((x+22,y+22),txt,font=font(22),fill=ink)
 elif t<8:
  a=ease(t-4);d.text((55,135),'Your first',font=font(51),fill=ink);d.text((55,201),'website.',font=font(51),fill=ink);d.text((58,302),'A clear place for your business.',font=font(19),fill=muted)
  x=int(450+(1-a)*120);y=94;d.rounded_rectangle((x,y,x+450,y+351),radius=16,fill=(248,245,235),outline=(193,207,189),width=2);d.line((x,y+35,x+450,y+35),fill=(205,215,199));
  for j in range(3):d.ellipse((x+18+j*12,y+15,x+24+j*12,y+21),fill=(184,201,183))
  d.text((x+27,y+60),'Your business',font=serif(18),fill=ink);d.text((x+27,y+109),'Good work.',font=serif(34),fill=ink);d.text((x+27,y+151),'In clear view.',font=serif(34),fill=ink)
  dy=int(40*(1-ease(t-4.5)));d.rounded_rectangle((x+309,y+104+dy,x+395,y+233+dy),radius=42,fill=(163,181,143));d.ellipse((x+280,y+176,x+339,y+235),fill=(206,193,160));d.line((x+27,y+274,x+420,y+274),fill=(196,211,189));d.text((x+27,y+294),'Our work     Our story     Get in touch',font=font(17),fill=muted)
 else:
  a=ease(t-8);x=int(55+(1-a)*50);d.text((x,151),'Good work deserves',font=font(51),fill=ink);d.text((x,219),'to be seen.',font=font(51),fill=ink);d.text((58,308),'Start with your story. Review before release.',font=font(22),fill=muted);d.rounded_rectangle((58,379,289,433),radius=27,fill=ink);d.text((86,390),'Your first website',font=font(22),fill=paper)
 d.text((55,491),'A motion illustration of the Solborne journey.',font=font(13),fill=muted)
 if i==int(FPS*6.5):im.save(out/'film-poster.jpg',quality=88)
 proc.stdin.write(im.tobytes())
proc.stdin.close();errors=proc.stderr.read();code=proc.wait()
if code:raise RuntimeError(errors.decode()[-1200:])
print('Rendered original 12-second H.264 motion film:',(out/'solborne-film.mp4').stat().st_size,'bytes')
