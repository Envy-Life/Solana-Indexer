import * as fs from "fs";
import {PublicKey} from "@solana/web3.js";
import { BN} from "@project-serum/anchor";
import * as yaml from "js-yaml";

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

function parseEventString(params : {event : string; handler : string;}) {
    const event = params.event;

    const handler = params.handler;
    const eventName = event.split("(")[0];
    const eventParams = event.split("(")[1].split(")")[0];
    const eventParamsArray = eventParams.split(",");
    const eventParamsArrayParsed = eventParamsArray.map(param => {
        const paramName = param.split(" ")[0];
        const paramType = param.split(" ")[param.split(" ").length - 1];
        return {
            name: paramName,
            type: paramType
        }
    }).filter(param => param.name !== "this");
    return {
        name: eventName,
        params: eventParamsArrayParsed,
        handler: handler
    }   
}

let mapper : Map<string,string> = new Map<string,string> ([
    ["publicKey" , "PublicKey"],
    ["bool" , "boolean"],
    ["string" , "string"],
    ["number","number"],
    ["u8" , "number"],
    ["i8" , "number"],
    ["u16" , "number"],
    ["i16" , "number"],
    ["u32" , "number"],
    ["i32" , "number"],
    ["f32" , "number"],
    ["f64" , "number"],
    ["u64" , "BN"],
    ["i64" , "BN"],
    ["u128" , "BN"],
    ["i128" , "BN"],
])

export async function generator() {
    // check if needed files exist
    if (!fs.existsSync("./indexer.yaml")) {
        throw new Error("indexer.yaml not found");
    }

    if (fs.existsSync("./interfaces.ts")){
        fs.unlinkSync('./interfaces.ts')   
    }

    const indexer  = yaml.load(fs.readFileSync('./indexer.yaml', 'utf8')) as yamlInterface;
    const eventList = indexer.eventHandlers.map(event => parseEventString(event));
    const entityList = indexer["entities"] ;

    for (let index = 0; index < entityList.length; index++) {
        let primarycount = 0;
        if (entityList[index]["name"].length < 1 ) {
            throw new Error("Entity name is required");
        }
        if (entityList[index]["name"].length > 32 ) {
            throw new Error("Entity name must be less than 32 characters");
        }
        if (entityList[index]["name"].indexOf(" ") >= 0) {
            throw new Error("Entity name must not contain spaces");
        }
        if (entityList[index]["params"].length < 1) {
            throw new Error("At least one parameter is required");
        }
        for (let index2 = 0; index2 < entityList[index]["params"].length; index2++) {
            if (entityList[index]["params"][index2]["primary"]) {
                if (!(entityList[index]["params"][index2]["type"] == "string" || entityList[index]["params"][index2]["type"] == "number")) {
                    throw new Error("Primary key must be string or number")
                }
                primarycount+= 1
            }
        }

    if (primarycount > 1) {
        throw new Error("Only one primary entity is allowed");
    }
    
    if (primarycount < 1) {
        throw new Error("At least one primary entity is required");
    }
    }

    var logger : fs.WriteStream = fs.createWriteStream('./interfaces.ts', {
        flags: 'w+'
    })

    logger.write(`import { PublicKey } from "@solana/web3.js";\n`);
    logger.write(`import { BN } from "@project-serum/anchor";\n\n\n`);

    for (let index = 0; index < eventList.length; index++) {
        const element = eventList[index];
    
        logger.write("export interface "+ element["name"].replace(/\s/g, "") + " {")
        for (let index = 0; index < element["params"].length; index++) {
            const element1 = element["params"][index];
            logger.write("\n\t" + "\"" + element1["name"].replace(/\s/g, "") + "\"" +  ":"+mapper.get(element1["type"])+";")
        }
        logger.write("\n}\n\n")
    }
    
    for (let index = 0; index < entityList.length; index++) {
        const element = entityList[index];
    
        logger.write("export class "+ element["name"].replace(/\s/g, "") + " {")
        for (let index = 0; index < element["params"].length; index++) {
            const element1 = element["params"][index];
            logger.write("\n\t" + "\"" + element1["name"].replace(/\s/g, "") + "\"" +  ":"+mapper.get(element1["type"])+";")
        }
    
        logger.write("\n\n\t async load(")
        for (let index = 0; index < element["params"].length; index++) {
            const element1 = element["params"][index];
            if (element1["primary"] == true) {
                logger.write(element1["name"].replace(/\s/g, "") +  ":"+mapper.get(element1["type"]))
            }
        }
        logger.write(") : Promise<void> {\n")
        logger.write('\t\t// Loads the entity from the database into the object\n\t\t// entity.load("PrimaryEntity")\n\t}\n')
    
    
        logger.write("\n\tasync save() : Promise<void> {\n")
        logger.write("\t\t// Saves the entity to the database wd current values\n\t\t// entity.save()\n\t}\n}\n")
    }

    logger.close();
}