import { MongoClient, ObjectId } from 'mongodb'



const url = process.env.MONGO_URL == null ? 'mongodb://localhost:27017' : process.env.MONGO_URL;
const client = new MongoClient(url);
const db = client.db('Indexer');
console.log(url);


export async function loader(entityName : string,primId : string, primName : string) : Promise<undefined|object> {
    try {
        await client.connect()
    let cols = await db.collections();
    if (cols.find(x => process.env.PROJECT_ID + "." + entityName === x.collectionName) === undefined) {
        console.log("collection not found");
        return undefined;
    } 
    let col = db.collection(process.env.PROJECT_ID + "." + entityName);
    let data = await col.find({[primName] : primId}).toArray();
    if (data.length == 0) {
        console.log("data not found");
        return undefined;
    }
    return data[0];
    } catch (error) {
        console.log(error);
        console.log("err in loader");
        
        
    }

    
}

export async function saver(entityName : string,item : object, primId : string, primName : string) {
    try {
        await client.connect()
    let col = db.collection(process.env.PROJECT_ID + "." + entityName);
    console.log({[primName] : primId});
    let data = await col.find({[primName] : primId}).toArray();
    if (data.length == 0) {
        console.log("inserting");
        await col.insertOne(item);
    } 
    else {
        console.log("updating");
        await col.updateOne({[primName] : primId},{$set : item});
    }
    } catch (error) {
        console.log(error);
        console.log("err in saver");
    }
    
}