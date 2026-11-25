import {validateScreeningConfiguration,type ScreeningConfiguration} from '../../shared/screeningConfiguration';
import {Dimensions} from './Dimensions';
export function ScreeningConfigurationEditor({value,onChange,onValidity}:{value:ScreeningConfiguration;onChange:(value:ScreeningConfiguration)=>void;onValidity:(valid:boolean)=>void}){
 return <Dimensions initialConfig={value.dimensions} embedded onSaved={()=>{}} onChange={dimensions=>onChange({dimensions})} onValidity={onValidity}/>;
}
export function configurationError(value:ScreeningConfiguration){try{validateScreeningConfiguration(value);return '';}catch(e){return (e as Error).message;}}
