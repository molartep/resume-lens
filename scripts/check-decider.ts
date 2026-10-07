import 'dotenv/config';
import { checkDeciderHealth } from '../server/services/deciderService';
const status=await checkDeciderHealth();
if(!status.online){console.error('Decider is offline. Start the separately managed server at STRANDS_DECIDER_URL.');process.exitCode=1;}else console.log(`Decider online: ${status.model}; context window: ${status.maxLength ?? 'unknown'}`);
