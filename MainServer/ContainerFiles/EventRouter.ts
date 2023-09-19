import {
	handleU64Event,
	handleStringEvent,
	handlePubkeyEvent,
	handleU8Event,
} from './src/mapping';

import {
	U64Event,
	StringEvent,
	PubkeyEvent,
	U8Event,
} from './Interfaces';




export async function handleEvents(event : {name : string , params : object}) : Promise<void> {
	switch (event.name) {
		case "U64Event":
			await handleU64Event(event["params"] as U64Event);
			break;
		case "StringEvent":
			await handleStringEvent(event["params"] as StringEvent);
			break;
		case "PubkeyEvent":
			await handlePubkeyEvent(event["params"] as PubkeyEvent);
			break;
		case "U8Event":
			await handleU8Event(event["params"] as U8Event);
			break;
	}
}