import { LambdaConfig } from "./lambda-config";
import { LambdaDetails } from "./lambda-details";
import { LambdaAccessConfig } from "./lambda-access-config";
import { PolicyDocument } from "../security/policy/policy-document";
export declare class LambdaProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: LambdaConfig);
    static provisionAccess(name: string, config: LambdaAccessConfig): void;
    static createAccessPolicyDocument(config: Pick<LambdaAccessConfig, "lambdaDetails">): PolicyDocument;
    provision(): LambdaDetails;
}
