const inquirer = require('inquirer');
const fs = require('fs');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

function validateIDL(file) {
    try{
        const jsonString = fs.readFileSync(file);
        const program = JSON.parse(jsonString);
        if(program.version != null) {
            return true;
        }
        else {
            return false;
        }
    } catch (err) {
        return false;
    }
}


const indexerInputs = () => {
    const questions = [
        {
            type: "input",
            name: "INDEXER_NAME",
            message: "Enter Indexer Name :",
            validate: function(val) {
                if(val == "") {
                    return false;
                }
                return true;
            },
            default: "Indexer"
        },
        {
            type: "input",
            name: "PROGRAM_ID",
            message: "Enter Program ID :",
            validate: function(val) {
                if(val == "") {
                    return false;
                }
                return true;
            },
            default: "9XRQ3Wwv1Bawt1WPbp8yX8k4r6eM2ZZQyukFxJxAFtsq"
        },
        {
            type: "input",
            name: "PROGRAM_IDL",
            message: "IDL File Path (JSON File) :",
            validate: function(val) {
                if(val != "" && val.includes(".json") && fs.existsSync(val) && validateIDL(val)) {
                    return true;
                }
                return false;
            },
            default: "./idl.json"
        },
        {
            type: "number",
            name: "START_SLOT",
            message: "Enter the START Block Height :",
            validate: function(val) {
                if(val != ""){
                    return true;
                }
                return false;
            },
            default: 168891968
        },
        {
            type: "number",
            name: "POLLING_INTERVAL",
            message: "Enter the Polling Interval (in seconds) :",
            validate: function(val) {
                if(val != ""){
                    return true;
                }
                return false;
            },
            default: 10000
        }
    ];
    return inquirer.prompt(questions);
}

function transformIDL(answers) {
    try {
        const jsonString = fs.readFileSync(answers.PROGRAM_IDL);
        const program = JSON.parse(jsonString);
        let entities = [];
        let eventHandlers = [];
        let eventHandlerFunctions = [];
        program.events.map((event) => {
            entities.push(event.name);
            let eventFields = []
            event.fields.map((field) => {
                if(field.index) {
                    eventFields.push(field.name + " indexed " + field.type)
                }else {
                    eventFields.push(field.name + " " + field.type)
                }
            });
            eventHandlerFunctions.push("handle"+event.name);
            eventHandlers.push({
                event: event.name + "(" + eventFields.join(",") + ")",
                handler: "handle"+event.name
            });
        });
        return [{
            programId : answers.PROGRAM_ID,
            startSlot : answers.START_SLOT,
            pollingInterval : answers.POLLING_INTERVAL,
            eventHandlers: eventHandlers,
            entities: [
                {
                    "name" : "SampleEntity",
                    "params" : [
                        {
                            name : "PrimaryEntity",
                            type : "string",
                            primary : true
                        },
                        {
                            name : "NonPrimaryEntity",
                            type : "string",
                            primary : false
                        }
                    ]
                }
            ],
            
        }, eventHandlers];
    } catch (err) {
        console.log(err);
    }
}

function parseEventString(event, handler) {
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

function createMapping(answers,eventHandlers) {

    var logger = fs.createWriteStream('./'+answers.INDEXER_NAME+'/src/mapping.ts', {
        flags: 'a'
    })
    
    let eventList = eventHandlers.map((event) => {
        return parseEventString(event.event, event.handler);
    })

    logger.write("import {")
    for (let index = 0; index < eventList.length; index++) {
        const element = eventList[index];
        logger.write("\n\t"+ element["name"].replace(/\s/g, "") + ",")
    }
    logger.write("\n} from '../Interfaces';\n\n")

    logger.write("import { BN } from '@project-serum/anchor';\nimport { PublicKey } from '@solana/web3.js';\n")
    
    for (let index = 0; index < eventList.length; index++) {
        const element = eventList[index];
        logger.write("export async function "+element["handler"].replace(/\s/g, "")+"(params : "+element["name"].replace(/\s/g, "")+") {")
        logger.write("\n\t//TODO: Implement")
        logger.write("\n}\n\n")
    }
    
}


async function createNPM(answers) {
    fs.openSync("./"+answers.INDEXER_NAME+"/package.json", 'w');
    fs.writeFileSync("./"+answers.INDEXER_NAME+"/package.json", JSON.stringify({
            "name": answers.INDEXER_NAME,
            "version": "1.0.0",
            "description": "",
            "main": "index.js",
            "scripts": {
              "build": "grapher build",
            },
            "author": "",
            "license": "ISC",
            "dependencies": {
              "@project-serum/anchor": "^0.25.0",
              "@types/node": "^18.6.5",
              "ts-node": "^10.9.1",
            }
    },null,2), (err) => {
        if (err) {
            console.log(err);
        }
    });
}

async function createTSconfig(answers) {
    fs.openSync("./"+answers.INDEXER_NAME+"/tsconfig.json", 'w');
    fs.writeFileSync("./"+answers.INDEXER_NAME+"/tsconfig.json", JSON.stringify({
        "compilerOptions": {
        "module": "commonjs",
        "declaration": true,
        "removeComments": true,
        "allowSyntheticDefaultImports": true,
        "target": "es2017",
        "sourceMap": false,
        "outDir": "./dist",
        "baseUrl": "./",
        "incremental": true
        },
        "include": ["src/**/*.ts"],
        "exclude": ["node modules","test","lib", "**/*spec.ts"]
      },null,2), (err) => {
    if (err) {
        console.log(err);
    }
});
}

function installPackages(answers) {
    execSync("cd "+answers.INDEXER_NAME+" && npm i --silent");
}

export async function generateIndexerProject() {
    const answers = await indexerInputs();
    if(!fs.existsSync("./"+answers.INDEXER_NAME)) {
        fs.mkdirSync("./"+answers.INDEXER_NAME);
    } else {
        fs.rmdirSync("./"+answers.INDEXER_NAME, { recursive: true });
        fs.mkdirSync("./"+answers.INDEXER_NAME);
    }

    fs.openSync("./"+answers.INDEXER_NAME+"/indexer.yaml", 'w');
    let [data, eventHandlers] = transformIDL(answers);
    

    fs.writeFileSync("./"+answers.INDEXER_NAME+"/indexer.yaml", yaml.dump(data,{'sortKeys' : true} ), (err) => {
        if (err) {
            console.log(err);
        }
    });

    if(!fs.existsSync("./"+answers.INDEXER_NAME+"/idls")) {
        fs.mkdirSync("./"+answers.INDEXER_NAME+"/idls");
    }

    // Copy the IDL into the IDL folder
    fs.copyFileSync(answers.PROGRAM_IDL,"./"+answers.INDEXER_NAME+"/idls/IDL.json");

    if(!fs.existsSync("./"+answers.INDEXER_NAME+"/src")) {
        fs.mkdirSync("./"+answers.INDEXER_NAME+"/src");
    }

    createMapping(answers,eventHandlers);
    await createNPM(answers);
    await createTSconfig(answers);
    await installPackages(answers);    
}
