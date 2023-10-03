# Solana Indexer

## Working and Set Up : [video](https://youtu.be/CfmePfs1Eq8)
## Main Server Files

### [Index.ts](./MainServer/index.ts)

This is the main file that runs the server. It is responsible for setting up the server and the routes.

#### PORT 3000 (external port)

This is the port that the server will be listening on for requests coming from the outside world.

1. **POST** `/Indexer` : This will be controlling all the requests coming regarding the indexer.
**Responsibilities :**
* Creating new indexer
* Updating existing indexer
* Deleting existing indexer

#### PORT 3001 (internal port)

This is the port that the server will be listening on for requests coming from the containers.

1. **POST** `/Error` : This will be controlling all the requests coming in from containers whenever they have an error.
**Responsibilities :**
* Updating the error info in the database

2. **POST** `/Update` : This will be controlling all the requests coming in from containers whenever they have an update.
**Responsibilities :**
* Updating the latest block processed info in the database

## Indexer Client Files

### [index.ts](./IndexerClient/index.ts)

Entry point for the package , handles commands and calls the appropriate functions.

### [generator.ts](./IndexerClient/generator.ts)

This file contains the code for the generator function which is responsible for generating : 
* `interfaces.ts` - This file contains the interfaces for the events and entities and enables hard type checking.

### [init.ts](./IndexerClient/init.ts)

This file contains the code for the init function which is responsible for initializing the indexer folder and generating :
* `indexer.yaml` - This file contains the configuration for the indexer. The events are read from IDL and entities are sample entities.
* `mapping.ts` - This file contains the code for each event handler. It is responsible for processing the event and storing it in the database.
* npm and ts configs

## Container Files

### [index.ts](./MainServer/ContainerFiles/index.ts)

This file connects to the RPC and listens for events.

### [generatorFunction.ts](./MainServer/ContainerFiles/generatorFunction.ts)

This file contains the code for the generator function which is responsible for generating :
* `interfaces.ts` - This file contains the interfaces for the events and entities and enables hard type checking. (This is different from the previous one as it is generated with fully working functions for entities which point to `savingFunction.ts` and `loadingFunction.ts` instead of shell functions)
* `eventRouter.ts` - This file contains the code for the event router function which is responsible for routing the events to the appropriate event handler.
* `IDL_ts.ts` - exports the IDL as an interface and a json object.

### [DBFunctions.ts](./MainServer/ContainerFiles/DBFunctions.ts)

This file contains the code for the loading function which is responsible for loading and saving the entities from/to the database.

