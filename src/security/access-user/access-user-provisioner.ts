import { given } from "@nivinjoseph/n-defensive";
// import { AccessKey, User } from "@pulumi/aws/iam";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../nfra-config";
import { AccessUserDetails } from "./access-user-details";


export class AccessUserProvisioner
{
    private readonly _name: string;
    
    
    public constructor(name: string)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
    }
    
    
    public provision(): AccessUserDetails
    {
        const userName = `${this._name}-auser`;
        const user = new aws.iam.User(userName, {
            path: "/system/auser/",
            tags: {
                ...NfraConfig.tags,
                Name: userName
            }
        });
        
        const accessKey = new aws.iam.AccessKey(`${this._name}-akey`, {
            user: user.name
        });
        
        return {
            userArn: user.arn,
            accessKeyId: accessKey.id,
            accessKeySecret: accessKey.secret
        };
    }
}