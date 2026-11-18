import json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent
scenes=json.loads((root/'storyboard.json').read_text())
for i,scene in enumerate(scenes):
 text=root/'assets'/f'voice-{i}.txt';text.write_text(scene['voice'])
 subprocess.run(['say','-v','Samantha','-r','175','-f',str(text),'-o',str(root/'assets'/f'voice-{i}.aiff')],check=True)
