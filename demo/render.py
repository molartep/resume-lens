"""Silent 60-second walkthrough; preserves the original visual edit and captions."""
import json,subprocess,textwrap
from pathlib import Path
from brand import TOKENS,FONT_PATH
root=Path(__file__).resolve().parent
scenes=json.loads((root/'storyboard.json').read_text())
assets=root/'assets'; out=root/'output'
def run(args):subprocess.run(args,check=True)
recording=json.loads((out/'recording.json').read_text())
frames=recording['frames'];concat=[]
if frames[0]['time']>0:
 concat += ["file '"+str(Path(frames[0]['file']).resolve())+"'", f"duration {frames[0]['time']:.6f}"]
for i,frame in enumerate(frames):
 end=frames[i+1]['time'] if i+1<len(frames) else 60.5
 concat += ["file '"+str(Path(frame['file']).resolve())+"'", f"duration {max(.001,end-frame['time']):.6f}"]
concat.append("file '"+str(Path(frames[-1]['file']).resolve())+"'")
(assets/'frames-concat.txt').write_text('\n'.join(concat))
source=str(assets/'frames-concat.txt')
font=FONT_PATH;bold=font
deep=TOKENS['deep'].lstrip('#');ink=TOKENS['ink'].lstrip('#')
filters=['[0:v]fps=30,scale=1600:911[screen]','[1:v]fps=30,format=rgba[frame]','[frame][screen]overlay=160:84:shortest=1[base]']
filters.append(f'[base]drawbox=x=0:y=1000:w=1920:h=80:color=0x{deep}@0.96:t=fill[captionbase]')
last='captionbase'
for i,s in enumerate(scenes):
 title=assets/f'title-{i}.txt';title.write_text(s['title'])
 caption=assets/f'caption-{i}.txt';caption.write_text('\n'.join(textwrap.wrap(s['voice'],width=124)))
 name=f'c{i}'
 filters.append(f"[{last}]drawtext=fontfile='{bold}':textfile='{title}':x=420:y=32:fontsize=20:fontcolor=0x{ink}:enable='between(t,{s['start']},{s['end']-.01})',drawtext=fontfile='{font}':textfile='{caption}':x=(w-text_w)/2:y=1018:fontsize=23:line_spacing=6:fontcolor=0xffffff:enable='between(t,{s['start']},{s['end']-.01})'[{name}]")
 last=name
filters+=['[2:v]format=rgba,fade=t=out:st=4.6:d=0.4:alpha=1[intro]',f'[{last}][intro]overlay=0:0:enable=\'lt(t,5)\'[opening]','[3:v]format=rgba,fade=t=in:st=55:d=0.4:alpha=1[ending]','[opening][ending]overlay=0:0:enable=\'gte(t,55)\',fade=t=out:st=59.7:d=0.3,format=yuv420p[video]']
(assets/'composition.ffscript').write_text(';\n'.join(filters))
run(['ffmpeg','-v','warning','-y','-f','concat','-safe','0','-i',source,'-loop','1','-i',str(assets/'frame.png'),'-loop','1','-i',str(assets/'intro.png'),'-loop','1','-i',str(assets/'outro.png'),'-filter_complex_script',str(assets/'composition.ffscript'),'-map','[video]','-an','-t','60','-r','30','-c:v','libx264','-preset','medium','-crf','19','-movflags','+faststart',str(out/'resume-lens-demo.mp4')])
def ts(v):return f'{v//3600:02}:{v//60%60:02}:{v%60:02},000'
(out/'resume-lens-demo.srt').write_text('\n\n'.join(f"{i+1}\n{ts(s['start'])} --> {ts(s['end'])}\n{s['voice']}" for i,s in enumerate(scenes))+'\n')
run(['ffmpeg','-v','error','-y','-ss','30','-i',str(out/'resume-lens-demo.mp4'),'-frames:v','1',str(out/'poster.png')])
