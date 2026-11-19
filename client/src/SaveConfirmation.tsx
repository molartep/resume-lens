import {useEffect,useRef} from 'react';
export function SaveConfirmation({message,onClose}:{message:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 return <dialog ref={dialog} className="save-confirmation" aria-labelledby="settings-saved-title" aria-describedby="settings-saved-description" onClose={onClose}>
  <span className="saved-check" aria-hidden="true">✓</span><h2 id="settings-saved-title">Settings saved</h2><p id="settings-saved-description">{message}</p><button autoFocus className="primary" onClick={()=>dialog.current?.close()}>Done</button>
 </dialog>;
}
