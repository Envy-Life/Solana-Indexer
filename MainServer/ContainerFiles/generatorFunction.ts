import * as fs from 'fs';
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

const indexer  = yaml.load(fs.readFileSync('./indexer.yaml', 'utf8')) as yamlInterface;
const eventList = indexer["eventHandlers"].map(event => parseEventString(event));
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

export async function createidl_ts() {
    const idl = JSON.parse(fs.readFileSync('./idls/IDL.json', 'utf8'));
    let logger = fs.createWriteStream("./idls/IDL_ts.ts")
    logger.write('import { Idl } from "@project-serum/anchor";')
    logger.write("\n\nexport const IDL : Idl = " + idl)
    logger.close();
}

export async function createEventRouter() {
    if (fs.existsSync('./EventRouter.ts')) {
        fs.unlinkSync('./EventRouter.ts')
    }
    let logger  = fs.createWriteStream('./EventRouter.ts', {
        flags: 'a'
    })

    logger.write("import {")
for (let index = 0; index < eventList.length; index++) {
    const element = eventList[index];
    logger.write("\n\t"+ element["handler"] + ",")
}
logger.write("\n} from './src/mapping';\n\n")

logger.write("import {")
for (let index = 0; index < eventList.length; index++) {
    const element = eventList[index];
    logger.write("\n\t"+ element["name"].replace(/\s/g, "") + ",")
}
logger.write("\n} from './Interfaces';\n\n")

logger.write("\n\n\n")

logger.write("export async function handleEvents(event : {name : string , params : object}) : Promise<void> {")
logger.write("\n\tswitch (event.name) {")
for (let index = 0; index < eventList.length; index++) {
    const element = eventList[index];
    logger.write("\n\t\tcase \""+element["name"]+"\":")
    logger.write("\n\t\t\tawait "+element["handler"]+"(event[\"params\"] as "+ element["name"].replace(/\s/g, "") + ");")
    logger.write("\n\t\t\tbreak;")
}
logger.write("\n\t}")
logger.write("\n}")


logger.close();

}

export async function createInterfaces() {
    if (fs.existsSync('./Interfaces.ts')) {
        fs.unlinkSync('./Interfaces.ts')
    }

    var logger : fs.WriteStream = fs.createWriteStream('./Interfaces.ts', {
        flags: 'w+'
    })

    logger.write(`import { PublicKey } from "@solana/web3.js";\n`);
logger.write('import { loader,saver } from "./DBFunctions";\n');
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
        logger.write("\n\t" + "" + element1["name"].replace(/\s/g, "") +  ":"+mapper.get(element1["type"])+" | undefined;")
    }

    logger.write("\n\n\t async load(")
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        if (element1["primary"] == true) {
            logger.write(element1["name"].replace(/\s/g, "") +  ":"+mapper.get(element1["type"]))
        }
    }
    logger.write(") {\n")
    logger.write("\t\tlet temp = await loader(\"" + element["name"].replace(/\s/g, "") + "\",")
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        if (element1["primary"] == true) {
            logger.write(element1["name"].replace(/\s/g, ""))
            logger.write(", \"")
            logger.write(element1["name"].replace(/\s/g, ""))
            logger.write("\"")
        }
    }
    logger.write(") as " + element["name"].replace(/\s/g, "") + "\n\t\t")
    logger.write("if (temp === undefined) {\n")
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        logger.write("\t\t\tthis." + element1["name"].replace(/\s/g, "") + " = undefined;\n")
    }
    logger.write("\n\t\t} else {\n")
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        logger.write("\t\t\tthis." + element1["name"].replace(/\s/g, "") + " = temp." + element1["name"].replace(/\s/g, "") + ";\n")
    }
    logger.write("\n\t\t}\n\t}\n")

    logger.write("\n\tasync save() : Promise<void> {\n\t")
    let tempPrim = ""
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        if (element1["primary"] == true) {
            tempPrim = element1["name"].replace(/\s/g, "")
            logger.write("\tif (this." + element1["name"].replace(/\s/g, "") + " === null) {")
            logger.write("\n\t\t\tthrow new Error(\"" + element1["name"].replace(/\s/g, "") + " is null\");\n\t\t}")
        }
    }
    
    logger.write("\n\t\tawait saver(\"" + element["name"].replace(/\s/g, "") + "\", this, this." + tempPrim +" as string, \"" + tempPrim + "\");")
    logger.write("\n\t}\n")
    logger.write("}\n\n")
}
}

createInterfaces();

createEventRouter();

