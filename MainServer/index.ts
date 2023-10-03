import { MongoClient } from 'mongodb'
import express from 'express';
import { Request , Response} from 'express';
import { createNewIndexer ,killIfCOntainerExists } from './helperFunctions';
import * as yaml from 'js-yaml';
import axios from 'axios';
const { mongoURL } = require("./secrets.json")
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()




// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// let authNames = ["indexer-eafe9"]
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// const firebaseConfig = {
//   apiKey: apiKey,
//   authDomain: authDomain,
//   projectId: projectId,
//   storageBucket: storageBucket,
//   messagingSenderId: messagingSenderId,
//   appId: appId
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const auth = firebaseAuth.getAuth(app);

// Connection URL
const url = mongoURL;
const client = new MongoClient(url);

// Database Name
const dbName = 'Indexer';

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

// async function authVerify(req :Request, res: Response) {
//     try {
//         if (req.headers.authorization == undefined) {
//             console.log(1);
//             res.status(403).send({
//                 "error" : "Not Authorized"
//             });
//             return false;
//         } else {
//             req.headers.authorization = req.headers.authorization.split(" ")[1];
//             let headers = jwt_decode(req.headers.authorization , {header: true});
//             let payload = jwt_decode(req.headers.authorization);
            
//             if (headers.alg != "RS256") {
//                 console.log(2);
//                 res.status(403).send({
//                     "error" : "Not Authorized"
//                 });
//                 return false;
//             }
//             let resp = await axios.get("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com")
//             if (resp.data[headers.kid] == undefined) {
//                 console.log(3);
//                 res.status(403).send({
//                     "error" : "Not Authorized"
//                 });
//                 return false;
//             }
//             // TODO : UNCOMMENT BEFORE DEPLOYMENT
//             if (payload.exp > Date.now() && payload.iat < Date.now()) {
//                 console.log(4);
//                 res.status(403).send({
//                 "error" : "Not Authorized"
//             });
//                 return false;
//             }
//             if (authNames.indexOf(payload.aud) == undefined) {
//                 console.log(5);
//                 res.status(403).send({
//                     "error" : "Not Authorized"
//                 });
//                 return false;
//             }
//             if (authNames.map(x => "https://securetoken.google.com/" + x).indexOf(payload.iss) == undefined) {
//                 console.log(6);
//                 res.status(403).send({
//                     "error" : "Not Authorized"
//                 });
//                 return false;
//             }
//             return payload.user_id;
//         }
//     } catch (error) {
//         console.log(7);
//         console.log(error);
//         res.status(403).send({
//             "error" : "Not Authorized"
//         });
//         return false
//     }
// }

// async function verifyOwnership(uid : string , projId : string , res : Response) {
//     let db = client.db(dbName);
//     let collection = db.collection("UserData");
//     let doc = await collection.findOne({userId : uid});
//     if (doc == null) {
//         res.status(403).send({
//             "error" : "Not Authorized"
//         });
//         return false;
//     }
//     if (doc.projs.indexOf(projId) == -1) {
//         res.status(403).send({
//             "error" : "Not Authorized"
//         });
//         return false;
//     }
//     return true;
// }



// collections :
//     * ProjectData :
//         * {projId} :
//             * Meta
//             * lastprocessedblock
//             * lastupdated
//             * error : {"error message", "blocknum" ....}
//     * UserData :
//         * {userId} :
//             * Meta
//     * {projId}.{entity}

client.connect()

const userApp = express()
const dockerApp = express()
const Externalport = 3000
const Internalport = 3001

userApp.post('/indexer/new' , jsonParser, async (req : Request, res: Response) => {
    try {
        let user : string = req.body.user;
        let repo : string = req.body.repo;
        let branch : string = req.body.branch;
        let projid : string = req.body.projid;
        let RPC : string = req.body.RPC;
        let db = client.db(dbName);
        let collection = db.collection("ProjectData");
        let colres = await collection.findOne({projId : projid})
        if (colres != null) {
            res.status(400).send("Indexer already exists");
            return;
        }
        let indexerYaml = yaml.load((await axios.get("https://raw.githubusercontent.com/" + user + "/" + repo + "/" + branch + "/indexer.yaml")).data) as yamlInterface;
        let entities = indexerYaml.entities;
        for (let i = 0; i < entities.length; i++) {
            await db.createCollection(projid + "." + entities[i].name);
        }
        // create new indexer container
        await createNewIndexer(projid, user, repo, branch, RPC,mongoURL);
        await collection.insertOne({projId : projid, Meta : {user : user, repo : repo, branch : branch}, lastprocessedblock : 0, lastupdated : null, error : null})
        // killIfCOntainerExists(req.body.projid);
        res.status(200).send("Indexer created");

    } catch (error) {
        killIfCOntainerExists(req.body.projid);
        res.status(500).send("Internal Server Error");
        console.log(error);
        return;
    }
})

userApp.post('/indexer/update' , jsonParser, async (req : Request, res: Response) => {
    try {
        let user : string = req.body.user;
        let repo : string = req.body.repo;
        let branch : string = req.body.branch;
        let projid : string = req.body.projid;
        let RPC : string = req.body.RPC;
        let db = client.db(dbName);
        let collection = db.collection("ProjectData");
        let colres = await collection.findOne({projId : projid})
        if (colres == null) {
            res.status(400).send("Indexer does not exist");
            return;
        }
        killIfCOntainerExists(projid);

        let collections = await db.collections();
        for (let i = 0; i < collections.length; i++) {
            if (collections[i].collectionName.startsWith(projid + ".")) {
                await collections[i].drop();
            }
        }

        let indexerYaml = yaml.load((await axios.get("https://raw.githubusercontent.com/" + user + "/" + repo + "/" + branch + "/indexer.yaml")).data) as yamlInterface;
        let entities = indexerYaml.entities;
        for (let i = 0; i < entities.length; i++) {
            await db.createCollection(projid + "." + entities[i].name);
        }

        await createNewIndexer(projid, user, repo, branch, RPC,mongoURL);
        await collection.replaceOne({projId : projid}, {projId : projid, Meta : {user : user, repo : repo, branch : branch}, lastprocessedblock : 0, lastupdated : (new Date()).getTime(), error : null})
        res.status(200).send("Indexer updated");

    } catch (error) {
        res.status(500).send("Internal Server Error");
        console.log(error);
        return;
    }
})

userApp.post('/indexer/delete' , jsonParser, async (req : Request, res: Response) => {
    try {
        let user : string = req.body.user;
        let repo : string = req.body.repo;
        let branch : string = req.body.branch;
        let projid : string = req.body.projid;
        let RPC : string = req.body.RPC;
        let db = client.db(dbName);
        let collection = db.collection("ProjectData");
        let colres = await collection.findOne({projId : projid})
        if (colres == null) {
            res.status(400).send("Indexer does not exist");
            return;
        }
        killIfCOntainerExists(projid);

        let collections = await db.collections();
        for (let i = 0; i < collections.length; i++) {
            if (collections[i].collectionName.startsWith(projid + ".")) {
                await collections[i].drop();
            }
        }

        await collection.updateOne({projId : projid}, {$set : {deleted : true}})
        res.status(200).send("Indexer deleted");
        return;

    } catch (error) {
        res.status(500).send("Internal Server Error");
        console.log(error);
        return;
    }
})

// userApp.post('/signUp' , jsonParser , async (req : Request, res: Response) => {
//     try {
//         let email : string = req.body.email;
//         let password : string = req.body.password;
//         let res1 = await firebaseAuth.createUserWithEmailAndPassword(auth,email, password)
//         let db = client.db(dbName);
//         let collection = db.collection("UserData");
//         await collection.insertOne({userId : res1.user.uid, Meta : {email : email}})
//         res.status(200).send(JSON.stringify({
//             "token" : await res1.user.getIdToken(),
//         }));
//     } catch (error : any) {
//         res.status(500).send(error.message);
//         return;
//     }
// })

// userApp.post('/signIn' , jsonParser , async (req : Request, res: Response) => {
//     try {
//         let email : string = req.body.email;
//         let password : string = req.body.password;
//         let res1 = await firebaseAuth.signInWithEmailAndPassword(auth,email, password)
//         res.status(200).send(JSON.stringify(
//             {
//                 "token" : await res1.user.getIdToken(),
//             }
//         ));
//     } catch (error : any) {
//         res.status(500).send(error.message);
//         return;
//     }
// })

dockerApp.post('/Error' ,jsonParser, async (req : Request, res: Response) => {
    try {
        let projId : string = req.body.projId;
        let error : string = req.body.error;
        let blocknum : number = req.body.blocknum;
        let db = client.db(dbName);
        let collection = db.collection("ProjectData");
        collection.updateOne({projId : projId}, {$set : {error : {error : error, blocknum : blocknum}, paused : true}})
        res.status(200).send("OK");
    } catch (error : any) {
        res.status(500).send(error.message);
    }
})

dockerApp.post('/Update' ,jsonParser , async (req : Request, res: Response) => {
    try {
        let projId : string = req.body.projId;
        let blocknum : number = req.body.blocknum;
        let db = client.db(dbName);
        let collection = db.collection("ProjectData");
        collection.updateOne({projId : projId}, {$set : {lastprocessedblock : blocknum, error : null}})
        res.status(200).send("OK");
    } catch (error : any) {
        res.status(500).send(error.message);
    }
})


userApp.listen(Externalport, () => {
    console.log(`User app listening at http://localhost:${Externalport}`)
})

dockerApp.listen(Internalport, () => {
    console.log(`Docker app listening at http://localhost:${Internalport}`)
})





