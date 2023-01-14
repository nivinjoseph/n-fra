import { given } from "@nivinjoseph/n-defensive";
import { PolicyConfig } from "./policy-config";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../nfra-config";
import { PolicyDetails } from "./policy-details";


export class PolicyProvisioner
{
    private readonly _name: string;
    private readonly _config: PolicyConfig;
    
    
    public constructor(name: string, config: PolicyConfig)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        
        given(config, "config").ensureHasValue().ensureHasStructure({
            document: "object",
            "userName?": "string",
            "roleName?": "string"
        });
        this._config = config;
    }
    
    
    public provision(): PolicyDetails
    {
        const policyName = `${this._name}-pol`;
        const policy = new aws.iam.Policy(policyName, {
            path: "/",
            policy: this._config.document,
            tags: {
                ...NfraConfig.tags,
                Name: policyName
            }
        });
        
        if (this._config.userName != null)
        {
            new aws.iam.UserPolicyAttachment(`${this._name}-upa`, {
                policyArn: policy.arn,
                user: this._config.userName
            });
        }
        
        if (this._config.roleName != null)
        {
            new aws.iam.RolePolicyAttachment(`${this._name}-rpa`, {
                policyArn: policy.arn,
                role: this._config.roleName
            });
        }
        
        return {
            policyArn: policy.arn
        };
    }
}