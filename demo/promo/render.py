"""45-second promo: recorded UI interactions, animated evidence, fixed camera."""
from pathlib import Path
import json,math,subprocess,wave,textwrap,bisect,sys
from functools import lru_cache
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
root=Path(__file__).resolve().parent
sys.path.insert(0,str(root.parent))
from brand import TOKENS,logo,font as brand_font,FONT_PATH
assets=root/'assets';out=root/'output';out.mkdir(exist_ok=True)
manifest=json.loads((assets/'voice-manifest.json').read_text());scenes=manifest['scenes']
extra=45-sum(s['voiceDuration']+.45 for s in scenes)
assert extra>=0, 'Narration must fit naturally; shorten script instead of accelerating it.'
weights={'hook':.1,'brand':0,'criteria':.25,'threshold':.15,'speed':0,'scores':.2,'evidence':.2,'close':.1}
time=0
for i,s in enumerate(scenes):
 s['start']=time;s['duration']=s['voiceDuration']+.45+extra*weights[s['id']];time+=s['duration'];s['end']=time
(out/'timeline.json').write_text(json.dumps(scenes,indent=2))
W,H=1920,1080;FPS=30
font_path=FONT_PATH
fonts={}
def font(size,bold=False):
 key=(size,bold)
 if key not in fonts:fonts[key]=brand_font(size,bold)
 return fonts[key]
def ease(p):return 1-(1-max(0,min(1,p)))**3
# Original music: warm pads, syncopated plucks and restrained percussion. No samples.
SR=48000;N=45*SR;voice=np.zeros(N,dtype=np.float32);music=np.zeros(N,dtype=np.float32);rng=np.random.default_rng(7)
for s in scenes:
 with wave.open(str(assets/f"voice-{s['id']}.wav"),'rb') as f:
  rate=f.getframerate();data=np.frombuffer(f.readframes(f.getnframes()),dtype=np.int16).astype(np.float32)/32768
 data=np.interp(np.arange(int(len(data)*SR/rate))*rate/SR,np.arange(len(data)),data).astype(np.float32)
 offset=round((s['start']+.18)*SR);length=min(len(data),N-offset);voice[offset:offset+length]+=data[:length]
beat=60/96;bar=beat*4
chords=[[48,55,60,63],[44,51,56,60],[51,58,63,67],[46,53,58,62]]
for k,start in enumerate(np.arange(0,45,bar)):
 count=min(int(bar*SR),N-int(start*SR));t=np.arange(count)/SR;env=np.minimum(t/.15,1)*np.minimum((bar-t)/.3,1)
 for note in chords[k%4]:
  hz=440*2**((note-69)/12);music[int(start*SR):int(start*SR)+count]+=(.0035*np.sin(2*np.pi*hz*t)+.0012*np.sin(2*np.pi*hz*2.002*t))*env
for k,start in enumerate(np.arange(0,45,beat/2)):
 offset=int(start*SR);count=min(int(.24*SR),N-offset);t=np.arange(count)/SR
 if k%2==0:
  kick=np.sin(2*np.pi*(48*t+35*(1-np.exp(-t*35))/35))*np.exp(-t*22)*.025;music[offset:offset+count]+=kick
 hat=rng.normal(0,1,count).astype(np.float32);hat=np.concatenate([[0],np.diff(hat)]);music[offset:offset+count]+=hat*np.exp(-t*85)*.0015
 if k%4 in (1,3):
  note=chords[(k//8)%4][(k//2)%4]+24;hz=440*2**((note-69)/12)
  music[offset:offset+count]+=(np.sin(2*np.pi*hz*t)+.25*np.sin(2*np.pi*hz*2*t))*np.exp(-t*13)*.006
# Keep the voice forward; duck the music during speech and fade both ends.
envelope=np.convolve(np.abs(voice)[::240],np.ones(25)/25,mode='same');duck=1-.65*np.clip(np.repeat(envelope,240)[:N]*16,0,1)
fade=np.minimum(np.arange(N)/(SR*.65),1)*np.minimum((N-np.arange(N))/(SR*1.0),1)
mix=(voice+music*duck)*fade
with wave.open(str(assets/'mix.wav'),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes((np.clip(mix,-1,1)*32767).astype(np.int16).tobytes())
# Fixed-camera interactive video panels. Every source viewport is contained in full.
clips={}
for scene in scenes:
 if scene['kind'] not in ('brand','close'):
  clip=json.loads((assets/'clips'/scene['id']/'manifest.json').read_text())
  assert not clip['layoutFailures'],f"Clipped content in {scene['id']}"
  clips[scene['id']]=clip
bg=Image.new('RGBA',(W,H),TOKENS['deep'])
accent=TOKENS['selected'];cream=TOKENS['surface'];muted='#C7D9D1';ink=TOKENS['ink']
brand_lockup=logo(True,294)
def txt(draw,xy,text,size=26,color=cream,bold=False,spacing=1.12):
 xx,yy=xy
 for line in text.split('\n'):draw.text((xx,yy),line,font=font(size,bold),fill=color);yy+=int(size*spacing)
mask=Image.new('L',(980,700));ImageDraw.Draw(mask).rounded_rectangle((0,0,979,699),radius=22,fill=255)
@lru_cache(maxsize=20)
def panel(file):
 source=Image.open(file).convert('RGB')
 # Contain, never cover/crop. No text is lost to a camera move or aspect ratio.
 scale=min(980/source.width,700/source.height)
 fitted=source.resize((round(source.width*scale),round(source.height*scale)),Image.Resampling.LANCZOS)
 tile=Image.new('RGB',(980,700),TOKENS['canvas']);tile.paste(fitted,((980-fitted.width)//2,(700-fitted.height)//2))
 tile=tile.convert('RGBA');tile.putalpha(mask);return tile
def clip_frame(scene_id,t):
 frames=clips[scene_id]['frames'];times=[f['time'] for f in frames];index=max(0,bisect.bisect_right(times,t)-1)
 return panel(frames[index]['file'])
def render_scene(s,local):
 im=bg.copy();d=ImageDraw.Draw(im)
 d.line((86,948,1834,948),fill=(75,113,86,255),width=1)
 im.alpha_composite(brand_lockup,(80,22))
 txt(d,(1510,42),'YOUR CRITERIA. IN FOCUS.',16,muted)
 txt(d,(90,980),'DECISION SUPPORT FOR RECRUITERS & HIRING TEAMS',17,muted)
 # The previous bottom-right information/disclaimer line is intentionally removed.
 for n in range(len(scenes)):d.rounded_rectangle((90+n*34,1024,112+n*34,1028),radius=2,fill=accent if n<=scenes.index(s) else '#476C53')
 layer=Image.new('RGBA',(W,H));ld=ImageDraw.Draw(layer)
 if s['kind'] in ('brand','close'):
  txt(ld,(120,230),s['eyebrow'],23,accent,True)
  if s['kind']=='brand':
   layer.alpha_composite(logo(True,920),(94,315))
   txt(ld,(120,585),'Bring your criteria into focus.',42,accent)
   txt(ld,(120,685),'Fast models. Professional evidence. Your judgment.',28,muted)
  else:
   txt(ld,(111,340),s['title'],105,cream,True,1.12)
   txt(ld,(120,650),s['body'],35,accent)
   layer.alpha_composite(logo(True,340),(105,745))
 else:
  txt(ld,(90,215),s['eyebrow'],21,accent,True)
  txt(ld,(82,320),s['title'],76,cream,True)
  txt(ld,(90,565),s['body'],29,muted,spacing=1.4)
  # The platform window is locked to the same coordinates for every frame.
  d.rounded_rectangle((883,188,1887,912),radius=32,fill=TOKENS['brand'])
  im.alpha_composite(clip_frame(s['id'],local),(895,200))
  if s['id']=='criteria':
   ld.rounded_rectangle((90,765,715,835),radius=35,fill=accent)
   txt(ld,(123,782),'YOUR QUESTIONS. YOUR SCORING RUBRIC.',20,ink,True)
 opacity=ease(local/.35)
 if opacity<1:layer.putalpha(layer.getchannel('A').point(lambda v:int(v*opacity)))
 return Image.alpha_composite(im,layer).convert('RGB')
# Feed lossless rendered frames directly to the encoder, avoiding large frame files.
cmd=['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(assets/'mix.wav'),'-map','0:v','-map','1:a','-af','loudnorm=I=-16:TP=-1.5:LRA=9','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t','45','-movflags','+faststart',str(out/'resume-lens-promo-45s.mp4')]
proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
try:
 for frame in range(45*FPS):
  t=frame/FPS;idx=next((i for i,s in enumerate(scenes) if s['start']<=t<s['end']),len(scenes)-1);s=scenes[idx];local=t-s['start'];img=render_scene(s,local)
  if idx>0 and local<.24:
   prev=render_scene(scenes[idx-1],scenes[idx-1]['duration']-.001);img=Image.blend(prev,img,ease(local/.24))
  if t<.35:img=Image.blend(Image.new('RGB',(W,H),TOKENS['deep']),img,t/.35)
  if t>44.65:img=Image.blend(img,Image.new('RGB',(W,H),TOKENS['deep']),(t-44.65)/.35)
  proc.stdin.write(img.tobytes())
  if frame%150==0:print(f'Rendering {t:.0f}/45 seconds',flush=True)
 proc.stdin.close();code=proc.wait();assert code==0
except BaseException:proc.kill();raise
def stamp(t):
 msec=round(t*1000);return f'{msec//3600000:02}:{msec//60000%60:02}:{msec//1000%60:02},{msec%1000:03}'
(out/'resume-lens-promo-45s.srt').write_text('\n\n'.join(f"{i+1}\n{stamp(s['start']+.18)} --> {stamp(s['start']+.18+s['voiceDuration'])}\n{s['voice'].replace('Résumé Lens','ResumeLens')}" for i,s in enumerate(scenes))+'\n')
for s in scenes:
 render_scene(s,min(1.8,s['duration']*.6)).save(out/f"preview-{s['id']}.jpg",quality=92)
render_scene(scenes[2],2.2).save(out/'poster.png')
print('Created 45-second promo.',flush=True)
