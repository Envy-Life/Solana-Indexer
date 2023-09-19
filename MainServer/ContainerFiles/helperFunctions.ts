import * as fs from 'fs';
import * as yaml from 'js-yaml';

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

export function getJSONMap(): any {
    return yaml.load(fs.readFileSync('./indexer.yaml', 'utf8')) as yamlInterface;
}
