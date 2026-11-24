import {Children,Fragment,isValidElement,useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
type Option={value:string;label:string;disabled:boolean};
type Props={value?:string;children:ReactNode;onValueChange:(value:string)=>void;disabled?:boolean;id?:string;name?:string;form?:string;required?:boolean;'aria-label'?:string;className?:string};
function optionsFrom(children:ReactNode):Option[]{return Children.toArray(children).flatMap(child=>{
 if(!isValidElement<{value?:string;children?:ReactNode;disabled?:boolean}>(child))return [];
 if(child.type===Fragment)return optionsFrom(child.props.children);
 const text=(nodes:ReactNode):string=>Children.toArray(nodes).map(n=>isValidElement<{children?:ReactNode}>(n)?text(n.props.children):String(n)).join('');
 const label=text(child.props.children);return [{value:String(child.props.value??label),label,disabled:!!child.props.disabled}];
});}
/** Shared single-select: focus stays on the combobox, with an active listbox option. */
export function Dropdown({value='',children,onValueChange,disabled,id,name,form,required,'aria-label':label,className=''}:Props){
 const uid=useId();const listId=`${uid}-options`;const trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),search=useRef({text:'',time:0});
 const [open,setOpen]=useState(false),[active,setActive]=useState(-1),[implicitLabel,setImplicitLabel]=useState('');
 const [position,setPosition]=useState<{left:number;top?:number;bottom?:number;width:number;maxHeight:number}>({left:0,top:0,width:0,maxHeight:280});
 const options=optionsFrom(children),selected=options.find(o=>o.value===value);
 useEffect(()=>{const parent=trigger.current?.closest('label');if(parent)setImplicitLabel(Array.from(parent.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim());},[]);
 useLayoutEffect(()=>{
  if(!open)return;
  const place=()=>{const rect=trigger.current!.getBoundingClientRect();const below=window.innerHeight-rect.bottom-16,above=rect.top-16;const up=below<200&&above>below;const height=Math.min(280,Math.max(80,up?above:below));setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-rect.width-8)),top:up?undefined:rect.bottom+4,bottom:up?window.innerHeight-rect.top+4:undefined,width:Math.min(rect.width,window.innerWidth-16),maxHeight:height});};
  place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  const outside=(event:Event)=>{if(!trigger.current?.contains(event.target as Node)&&!popup.current?.contains(event.target as Node))setOpen(false);};
  document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);
  return ()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);};
 },[open]);
 useEffect(()=>{if(open)popup.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[open,active]);
 const enabled=options.map((o,i)=>o.disabled?-1:i).filter(i=>i>=0);
 function show(edge?:'first'|'last'){if(disabled||trigger.current?.matches(':disabled'))return;setActive(edge==='first'?enabled[0]??-1:edge==='last'?enabled.at(-1)??-1:options.findIndex(o=>o.value===value&&!o.disabled)>=0?options.findIndex(o=>o.value===value&&!o.disabled):enabled[0]??-1);setOpen(true);}
 function choose(index:number){const option=options[index];if(!option||option.disabled)return;setOpen(false);onValueChange(option.value);trigger.current?.focus();}
 return <span className={`dropdown ${className}`}><button ref={trigger} id={id} type="button" className="dropdown-trigger" role="combobox" aria-label={label||implicitLabel||undefined} aria-expanded={open} aria-haspopup="listbox" aria-controls={open?listId:undefined} aria-activedescendant={open&&active>=0?`${uid}-${active}`:undefined} aria-required={required||undefined} disabled={disabled} onClick={()=>open?setOpen(false):show()} onKeyDown={event=>{
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(!open){show(event.key==='Home'?'first':event.key==='End'?'last':undefined);return;}if(event.key==='Home')setActive(enabled[0]??-1);else if(event.key==='End')setActive(enabled.at(-1)??-1);else{const index=enabled.indexOf(active);setActive(enabled[(index+(event.key==='ArrowDown'?1:-1)+enabled.length)%enabled.length]??-1);}}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)choose(active);else show();}
  else if(event.key==='Escape'){event.preventDefault();setOpen(false);}
  else if(event.key==='Tab')setOpen(false);
  else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();const now=Date.now();search.current={text:(now-search.current.time<700?search.current.text:'')+event.key.toLowerCase(),time:now};const query=search.current.text;const start=open?active+1:0;const found=options.map((_,i)=>(start+i)%options.length).find(i=>!options[i].disabled&&options[i].label.toLowerCase().startsWith(query));if(!open)show();if(found!==undefined)setActive(found);}
 }}><span className="dropdown-value">{selected?.label||'Choose an option'}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>{name&&<input type="hidden" name={name} form={form} value={value} disabled={disabled}/>}{open&&createPortal(<div ref={popup} id={listId} role="listbox" aria-label={label||implicitLabel} className="dropdown-menu" style={position}>{options.map((option,i)=><div key={`${option.value}-${i}`} id={`${uid}-${i}`} data-index={i} role="option" aria-selected={option.value===value} aria-disabled={option.disabled||undefined} className={`dropdown-option ${i===active?'active':''}`} onPointerMove={()=>{if(!option.disabled)setActive(i);}} onPointerDown={event=>event.preventDefault()} onClick={event=>{event.preventDefault();choose(i);}}><span>{option.label}</span>{option.value===value&&<span aria-hidden="true">✓</span>}</div>)}</div>,document.body)}</span>;
}
