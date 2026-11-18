from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from PIL import Image, ImageDraw, ImageFont
import textwrap
root=Path(__file__).resolve().parent
assets=root/'assets'; assets.mkdir(exist_ok=True)
c=canvas.Canvas(str(assets/'synthetic-resume.pdf'),pagesize=(595,842))
c.setFillColor(HexColor('#183d30')); c.rect(0,694,595,148,fill=1,stroke=0)
c.setFillColor(HexColor('#a6c5b4'));c.setFont('Helvetica',10);c.drawString(48,801,'RESUME LENS / FICTIONAL DEMO RESUME')
c.setFillColor(HexColor('#ffffff'));c.setFont('Helvetica-Bold',28);c.drawString(48,750,'Alex Morgan')
c.setFont('Helvetica',12);c.drawString(48,724,'Backend engineering / production systems')
y=654
for title,lines in [('EXPERIENCE',['Backend Engineer | January 2021 - December 2024','Designed, tested and shipped billing APIs backed by PostgreSQL.','Owned production deployments and participated in on-call rotations.']),('MENTORSHIP',['Mentored two junior engineers through weekly code reviews.']),('APPLIED AI',['Built a retrieval-augmented support assistant using a large language','model and evaluated its answers against source documents.']),('OPEN SOURCE',['Contributed three merged fixes to an open-source HTTP client.'])]:
 c.setFillColor(HexColor('#35684e'));c.setFont('Helvetica-Bold',10);c.drawString(48,y,title);y-=26
 c.setFillColor(HexColor('#384f42'));c.setFont('Helvetica',11)
 for line in lines:c.drawString(48,y,line);y-=20
 y-=24
c.setFillColor(HexColor('#859489'));c.setFont('Helvetica',9);c.drawString(48,50,'Fictional content for demonstration. No real candidate information.');c.save()
font='/System/Library/Fonts/Supplemental/Arial.ttf'; bold='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def f(n,b=False):return ImageFont.truetype(bold if b else font,n)
def text(draw,xy,s,size=24,fill='#e9f1e9',b=False):draw.text(xy,s,font=f(size,b),fill=fill)
bg=Image.new('RGB',(1920,1080),'#e9efe9');d=ImageDraw.Draw(bg)
d.rounded_rectangle((145,75,1775,1008),radius=22,fill='#d2ded4')
text(d,(160,30),'RESUME LENS',22,'#29553d',True);text(d,(1185,32),'FICTIONAL DATA  /  SIMULATED PROVIDERS',18,'#627a69')
bg.save(assets/'frame.png')
def card(file,eyebrow,title,body,footer):
 im=Image.new('RGB',(1920,1080),'#143b2d');dr=ImageDraw.Draw(im)
 for x in range(1200,2100,100):dr.line((x,0,x-450,1080),fill='#1c4534',width=1)
 dr.rounded_rectangle((148,144,198,194),radius=12,fill='#a0bd9a');text(dr,(162,150),'R',30,'#143b2d',True)
 text(dr,(150,274),eyebrow,25,'#a4bea7')
 for i,line in enumerate(title.split('\n')):text(dr,(145,350+i*100),line,82,b=True)
 for i,line in enumerate(body.split('\n')):text(dr,(150,620+i*44),line,28,'#bbcebc')
 dr.line((150,877,1770,877),fill='#51745c',width=2)
 text(dr,(150,915),footer,23,'#a4bea7');im.save(assets/file)
card('intro.png','A 60-SECOND PRODUCT TOUR','Evidence first.\nHuman judgment.','Resume Lens / AI-assisted resume review','Synthetic resumes. Simulated provider responses. Real application workflow.')
card('outro.png','RESUME LENS','Clearer evidence.\nBetter human review.','Review dimensions, inspect the source, retain the context.','Fictional demonstration / Results are illustrative, not measured model performance.')
