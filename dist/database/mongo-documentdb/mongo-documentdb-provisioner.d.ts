import { MongoDocumentdbConfig } from "./mongo-documentdb-config.js";
import { MongoDocumentdbDetails } from "./mongo-documentdb-details.js";
export declare class MongoDocumentdbProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: MongoDocumentdbConfig);
    provision(): MongoDocumentdbDetails;
}
//# sourceMappingURL=mongo-documentdb-provisioner.d.ts.map