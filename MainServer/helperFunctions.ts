import axios from "axios";
var execSync = require('child_process').execSync;
import * as fs from 'fs';


export async function parseRepoLink(GHLink : string , branch : string | undefined) {
    let user;
    let repo ;
    
  // GETTING USER , REPO , BRANCH
  if (GHLink.startsWith("https://github.com")) {
    GHLink = GHLink.slice(19);
    if (GHLink.endsWith(".git")) {
      GHLink = GHLink.slice(0,GHLink.length-4);
    }
    if (GHLink.split("/").length == 2) {
      [user , repo] = GHLink.split("/");
    } else if (GHLink.split("/").length >= 4) {
      let split = GHLink.split("/");
      user = split[0];
      repo = split[1];
      branch = split.slice(3).join("/");
    } else {
      return ["invalid link"];
    }
  } else if (GHLink.startsWith("git@github.com")) {
    GHLink = GHLink.slice(15);
    GHLink = GHLink.slice(0,GHLink.length-4);
    [user , repo] = GHLink.split("/");
  } else {
    return ["Invalid GitHub link"];
  }

  if (branch == undefined) {
    let result = await axios.get("https://api.github.com/repos/" + user + "/" + repo)
    branch = result.data.default_branch;
  }
  
  return [user , repo , branch];
  
}

export async function killIfCOntainerExists(projid: string)  {
  let exists = execSync("sudo docker container ls -a -f name=^/" + projid + "$").toString()
  if (exists.trim().split("\n").length >1) {
    let temp = exists.split("\n")[1].split("  ").map((x : string) => x.trim()).filter((x : string) => x != "")
    if (temp[4].split(" ")[0] != "Exited") {
      await execSync("sudo docker kill " + projid)
    }
    await execSync("sudo docker rm " + projid)
    await execSync("sudo docker image prune -a -f")
  }
}

export async function createNewIndexer(projid: string, user: string, repo: string, branch: string, RPC: string, mongoURL: string) {
try {
let data : string = "FROM node:alpine\nWORKDIR /home/node/app\nRUN apk update && apk add git && npm install --location=global ts-node\n";
    data += "RUN git clone https://github.com/" + user + "/" + repo + " -b " + branch+"\n"
    data += "WORKDIR /home/node/app/" + repo + "\n"
    data += "RUN npm install\n"
    data += "RUN npm i js-yaml\nRUN npm i @types/js-yaml\nRUN npm i dotenv\n"
    data += "RUN npm i axios\n"
    data += "RUN npm i mongodb\n"
    data += "COPY ./ContainerFiles .\n"
    data += "RUN ts-node ./generatorFunction.ts\n"
    data += "ENV MONGO_URL " + mongoURL + "\n" 
    data += "ENV PROJECT_ID " + projid + "\n" 
    data += "ENV RPC " + RPC + "\n"
    data += "CMD [\"ts-node\", \"./index.ts\"]\n"
fs.writeFileSync("./" + projid + ".Dockerfile.processor", data)
execSync("docker build --no-cache -f "+ projid +".Dockerfile.processor -t " + projid + ":latest .");
execSync('docker run --net=host -d --name ' + projid + ' ' + projid + ':latest');
execSync('rm ' +  projid + ".Dockerfile.processor")
} catch (error : any) {
  console.log(error.stderr.toString());
    if (error.stderr.toString().includes("branch" + branch + " not found")) {
      throw new Error("Branch not found");
    } else if (error.stderr.toString().includes(user + "/" + repo + "/' not found")) {
      throw new Error("Repo doesn't exist or is private");
    } else {
      throw error;
    }
}
}