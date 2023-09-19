import { PublicKey } from "@solana/web3.js";
import { loader,saver } from "./DBFunctions";
import { BN } from "@project-serum/anchor";


export interface U64Event {
	"data":BN;
	"label":string;
}

export interface StringEvent {
	"id":BN;
	"data":string;
	"label":string;
}

export interface PubkeyEvent {
	"id":BN;
	"data":PublicKey;
	"label":string;
}

export interface U8Event {
	"id":BN;
	"data":number;
	"label":string;
}

export class SampleEntity {
	PrimaryEntity:string | undefined;
	NonPrimaryEntity:string | undefined;

	 async load(PrimaryEntity:string) {
		let temp = await loader("SampleEntity",PrimaryEntity, "PrimaryEntity") as SampleEntity
		if (temp === undefined) {
			this.PrimaryEntity = undefined;
			this.NonPrimaryEntity = undefined;

		} else {
			this.PrimaryEntity = temp.PrimaryEntity;
			this.NonPrimaryEntity = temp.NonPrimaryEntity;

		}
	}

	async save() : Promise<void> {
		if (this.PrimaryEntity === null) {
			throw new Error("PrimaryEntity is null");
		}
		await saver("SampleEntity", this, this.PrimaryEntity as string, "PrimaryEntity");
	}
}

