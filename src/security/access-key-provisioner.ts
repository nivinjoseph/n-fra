import { given } from "@nivinjoseph/n-defensive";
import { AccessKey, User } from "@pulumi/aws/iam";
import { InfraConfig } from "../infra-config";
import { AccessKeyDetails } from "./access-key-details";


export class AccessKeyProvisioner
{
    private readonly _name: string;
    
    
    public constructor(name: string)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
    }
    
    
    public provision(): AccessKeyDetails
    {
        const userName = `${this._name}-aku`;
        const user = new User(userName, {
            path: "/system/aku/",
            tags: {
                ...InfraConfig.tags,
                Name: userName
            }
        });
        
        const accessKey = new AccessKey(`${this._name}-ak`, {
            user: user.name
        });
        
        return {
            userArn: user.arn,
            accessKeyId: accessKey.id,
            accessKeySecret: accessKey.secret
        };
    }
}