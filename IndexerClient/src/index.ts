#!/usr/bin/env ts-node

import * as yargs from "yargs";
import { generateIndexerProject } from "./init"
import { generator } from "./generator"

let args = yargs.argv;


if (args["_"].toString().toLowerCase() == "init") {
    generateIndexerProject();
} else if (args["_"].toString().toLowerCase() == "build") {
    generator();
} 