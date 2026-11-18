from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from PIL import Image,ImageDraw
from brand import TOKENS,logo,font
root=Path(__file__).resolve().parent;assets=root/'assets';assets.mkdir(exist_ok=True)
c=canvas.Canvas(str(assets/'synthetic-resume.pdf'),pagesize=(595,842))
c.setFillColor(HexColor(TOKENS['deep']));c.rect(0,694,595,148,fill=1,stroke=0)
c.drawImage(ImageReader(logo(True,420)),44,786,width=168,height=40,mask='auto')
c.setFillColor(HexColor(TOKENS['surface']));c.setFont('Helvetica-Bold',28);c.drawString(48,746,'Alex Morgan')
c.setFont('Helvetica',12);c.drawString(48,720,'Backend engineering / production systems')
y=654
for title,lines in [('EXPERIENCE',['Backend Engineer | January 2021 - December 2024','Designed, tested and shipped billing APIs backed by PostgreSQL.','Owned production deployments and participated in on-call rotations.']),('MENTORSHIP',['Mentored two junior engineers through weekly code reviews.']),('APPLIED AI',['Built a retrieval-augmented support assistant using a large language','model and evaluated its answers against source documents.']),('OPEN SOURCE',['Contributed three merged fixes to an open-source HTTP client.'])]:
 c.setFillColor(HexColor(TOKENS['brand']));c.setFont('Helvetica-Bold',10);c.drawString(48,y,title);y-=26
 c.setFillColor(HexColor(TOKENS['ink']));c.setFont('Helvetica',11)
 for line in lines:c.drawString(48,y,line);y-=20
 y-=24
c.setFillColor(HexColor(TOKENS['text-muted']));c.setFont('Helvetica',9);c.drawString(48,50,'Fictional content for demonstration. No real candidate information.');c.save()
def text(draw,xy,s,size=24,fill=None,b=False):draw.text(xy,s,font=font(size,b),fill=fill or TOKENS['surface'])
bg=Image.new('RGB',(1920,1080),TOKENS['canvas']);d=ImageDraw.Draw(bg)
d.rounded_rectangle((145,75,1775,1008),radius=16,fill=TOKENS['border'])
bg.paste(logo(False,260),(145,5),logo(False,260));text(d,(1185,32),'FICTIONAL DATA / SIMULATED PROVIDERS',18,TOKENS['text-muted'])
bg.save(assets/'frame.png')
def card(file,eyebrow,title,body,footer):
 im=Image.new('RGB',(1920,1080),TOKENS['deep']);dr=ImageDraw.Draw(im)
 mark=logo(True,420);im.paste(mark,(132,125),mark)
 text(dr,(150,274),eyebrow,25,'#C7D9D1')
 for i,line in enumerate(title.split('\n')):text(dr,(145,350+i*100),line,82,b=True)
 for i,line in enumerate(body.split('\n')):text(dr,(150,620+i*44),line,28,'#C7D9D1')
 dr.line((150,877,1770,877),fill='#62877B',width=1)
 text(dr,(150,915),footer,23,'#C7D9D1');im.save(assets/file)
card('intro.png','A 60-SECOND PRODUCT TOUR','Evidence first.\nHuman judgment.','ResumeLens / AI-assisted resume review','Synthetic resumes. Simulated provider responses. Real application workflow.')
card('outro.png','YOUR CRITERIA. CLEARER DECISIONS.','Clear criteria.\nVisible evidence.','Review dimensions, inspect the source, retain the context.','Fictional demonstration / Results are illustrative, not measured model performance.')
