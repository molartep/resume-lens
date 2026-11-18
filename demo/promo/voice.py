"""Neural stock voice, generated locally; explicit pronunciation, no cloning."""
from pathlib import Path
import os,json,re
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
root=Path(__file__).resolve().parent
models=Path(os.environ.get('KOKORO_MODEL_DIR','/private/tmp/resume-lens-promo-models'))
engine=Kokoro(str(models/'kokoro-v1.0.onnx'),str(models/'voices-v1.0.bin'))
scenes=json.loads((root/'story.json').read_text())
voice=engine.get_voice_style('af_heart')
for scene in scenes:
 # Replace the brand and every document reference at the phoneme level.
 # /ˈrɛz.juː.meɪ/ with primary stress on the FIRST syllable, as requested.
 parts=re.split(r'(Résumé Lens|résumé)',scene['voice'])
 phonemes=' '.join('ˈɹɛzjumeɪ lɛnz' if s=='Résumé Lens' else 'ˈɹɛzjumeɪ' if s=='résumé' else engine.tokenizer.phonemize(s,'en-us') for s in parts if s)
 audio,sr=engine.create(phonemes,voice=voice,speed=1.0,lang='en-us',is_phonemes=True,sentence_pause=.18,clause_pause=.08)
 sf.write(root/'assets'/f"voice-{scene['id']}.wav",audio,sr)
 scene['voiceDuration']=len(audio)/sr;scene['phonemes']=phonemes
 print(scene['id'],round(len(audio)/sr,3),flush=True)
(root/'assets'/'voice-manifest.json').write_text(json.dumps({'engine':'Kokoro ONNX v1.0','voice':'af_heart (stock synthetic voice)','pronunciation':'ˈɹɛzjumeɪ lɛnz','scenes':scenes},indent=2))
