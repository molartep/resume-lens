"""Shared video branding from the platform's canonical token and asset files."""
from pathlib import Path
import re
from PIL import Image,ImageFont
ROOT=Path(__file__).resolve().parent.parent
BRAND=ROOT/'client'/'public'/'brand'
TOKENS=dict(re.findall(r'--rl-([\w-]+):\s*(#[0-9a-fA-F]{6})', (BRAND/'tokens.css').read_text()))
FONT_PATH='/System/Library/Fonts/SFNS.ttf'  # The manual's macOS system-font fallback; never distributed.
def font(size,bold=False):
 f=ImageFont.truetype(FONT_PATH,size)
 if bold:
  try:
   axes=f.get_variation_axes();values=[a['default'] for a in axes]
   for i,a in enumerate(axes):
    if b'Weight' in a['name']:values[i]=600
   f.set_variation_by_axes(values)
  except (AttributeError,OSError):pass
 return f
def logo(reversed=False,width=294):
 im=Image.open(BRAND/('logo-reversed.png' if reversed else 'logo-horizontal.png')).convert('RGBA')
 return im.resize((width,round(width*im.height/im.width)),Image.Resampling.LANCZOS)
