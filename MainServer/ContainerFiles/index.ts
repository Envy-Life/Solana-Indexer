export interface Transaction {
    signature: string;
    slot: number;
    err : object | null;
}

interface yamlInterface {
    programId : string;
    startSlot : number;
    pollInterval : number;
    eventHandlers : [
        {
            event : string;
            handler : string;
        }
    ];
    entities : [
        {
            name : string;
            params : [
                {
                    name : string;
                    type : string;
                    primary : boolean;
                }
            ]
        }
    ]
}

import * as fs from 'fs';
import { handleEvents } from './EventRouter';
require('dotenv').config();
import * as helperFns from './helperFunctions';
let configs : yamlInterface  = helperFns.getJSONMap();
const axios = require('axios');
let projId = process.env.PROJECT_ID;
let RPC = process.env.RPC // "https://solana-devnet.g.alchemy.com/v2/4ZhX3cAgEx_XXS2KDaqFx4O33laF49ov";
let program = configs.programId // "9XRQ3Wwv1Bawt1WPbp8yX8k4r6eM2ZZQyukFxJxAFtsq"; // DYSiRGFuYKjEyvzaf1fVTKCxVG8gWT9ZkkdLoqJ1wuJJ
let startslot = configs.startSlot // 168891968;
let mostRecentSignature: string | null = null;
let mostRecentSlot: number = startslot;
let transactionList : Transaction[] = [];
let pollInterval = configs.pollInterval  // 10000;
let events : any[] = [];

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

import * as anchor from "@project-serum/anchor";
import {
    Program,
    EventParser,
    Idl
} from "@project-serum/anchor";
import {
    Connection,
    PublicKey,
} from "@solana/web3.js";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";


let connection = new Connection((RPC as string) ,"finalized");
let keyPair = anchor.web3.Keypair.generate();
let nodeWallet = new NodeWallet(keyPair);

let provider = new anchor.AnchorProvider(connection, nodeWallet, {commitment: "finalized"});
let program1 = new Program( JSON.parse(fs.readFileSync("./idls/IDL.json").toString()) as Idl  , program, provider);
let eventParser = new EventParser( new PublicKey(program), program1.coder);

// DIDN'T WORK , GOING FOR POLLING AS A TEMPORARY SOLUTION
// async function subscribeToProgram() {}

async function pollForTransactions() {
    let flag1 = true;
    let tries = 10;
    let lastSignature = null;
    while (flag1) {
            console.log("Polling for transactions");
            let flag2 = true;
            while (tries > 0 && flag2) {
                let res : {"data" : {
                    "result" : Transaction[]
                }} = await axios.post(RPC, {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getSignaturesForAddress",
                    "params": [
                        program,
                        {
                            "limit": 1000,
                            "before" : lastSignature
                        }
                    ]
                })
                if (res.data.result.length == 0) {
                    tries -= 1;
                } else {
                    res.data.result.sort((a:Transaction,b:Transaction) => b.slot - a.slot);
                    res.data.result = res.data.result.filter((a:Transaction) => a.err == null);
                    let temp = res.data.result[res.data.result.length - 1].slot;
                    while (temp < mostRecentSlot) {
                        res.data.result.pop();
                        if (res.data.result.length == 0) {
                            break;
                        }
                        temp = res.data.result[res.data.result.length - 1].slot;
                        flag2 = false;
                    }
                    if (res.data.result.length != 0) {
                        lastSignature = res.data.result[res.data.result.length - 1].signature;
                        transactionList = transactionList.concat(res.data.result.map((a:Transaction) => new Object({ "signature" : a.signature, "slot" : a.slot}) as Transaction).reverse());   
                    }
                    tries = 10
            }
        }
        while (transactionList.length != 0) {
            let temp = transactionList.shift();
            if (temp != undefined) {
                mostRecentSlot = temp.slot;
                await processSlot(temp.slot);
            }
        }
        await delay(pollInterval);
        fs.writeFileSync('transactionList.json', JSON.stringify(transactionList));
        
    }
    
}

async function getPreviousTransactionSlots() {
    let flag = true;
    let tries = 10;
    let lastSignature = null;
    while (flag) {
        let res : {"data" : {
            "result" : Transaction[]
        }} = await axios.post(RPC, {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getSignaturesForAddress",
            "params": [
                program,
                {
                    "limit": 1000,
                    "before" : lastSignature
                }
            ]
        })
        if (res.data.result.length == 0) {
            tries -= 1;
            if (tries == 0) {
                flag = false;
            }
        } else {
            res.data.result.sort((a:Transaction,b:Transaction) => b.slot - a.slot);
            res.data.result = res.data.result.filter((a:Transaction) => a.err == null);
            let temp = res.data.result[res.data.result.length - 1].slot;
            while (temp < startslot) {
                res.data.result.pop();
                temp = res.data.result[res.data.result.length - 1].slot;
                flag = false;
            }
            lastSignature = res.data.result[res.data.result.length - 1].signature;
            transactionList = transactionList.concat(res.data.result.map((a:Transaction) => new Object({ "signature" : a.signature, "slot" : a.slot}) as Transaction));
            tries = 10
        }
    }
    transactionList.reverse();
    fs.writeFileSync('transactionList.json', JSON.stringify(transactionList));
    mostRecentSignature = transactionList[transactionList.length - 1].signature;
    while (transactionList.length != 0) {
        let temp = transactionList.shift();
        if (temp != undefined) {
            mostRecentSlot = temp.slot;
            await processSlot(temp.slot);
        }
    }
    pollForTransactions();
}

async function processSlot(slotNumber : Number) {
    
    let res = await axios.post(RPC, {"jsonrpc": "2.0","id":1,"method":"getBlock","params":[slotNumber, {"encoding": "json","maxSupportedTransactionVersion":0,"transactionDetails":"full","rewards":false}]})
    // console.log(res.data.error);
    // fs.writeFileSync("./" + slotNumber + ".json", JSON.stringify(res.data.result))
    let block = res.data.result;
    let logs: any[] = [];
    block?.transactions.map( async(transaction: { meta: { logMessages: any; }; }) => {
        logs.push(transaction?.meta?.logMessages);
    });
    logs = logs.join(",").split(",");
    
    for (const _event of eventParser.parseLogs(logs)) {
        let eventObj = {
             name : _event.name,
             params : _event.data
        }
        handleEvents(eventObj);
    }
    console.log(slotNumber);
    axios.post("http://localhost:3001/update", {
        "projId" : projId,
        "blocknum" : slotNumber,
    })
    
    // fs.writeFileSync("./"+slotNumber+"_events.json", JSON.stringify(events))

}


// subscribeToProgram();
function main() {
    try {
        getPreviousTransactionSlots();
    } catch (error : any) {
        axios.post("http://localhost:3001/error" , {
            "error" : error.message,
            "blocknum" : mostRecentSlot,
            "projId" : projId
        })
    }    
}

main();

// processSlot(190011972)