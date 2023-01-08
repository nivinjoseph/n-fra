import { EnvType } from "./env-type";
import { Tags } from "@pulumi/aws";
export declare class InfraConfig {
    private static readonly _pulumiAwsConfig;
    static get awsAccount(): string;
    static get awsRegion(): string;
    static get env(): EnvType;
    static get tags(): Tags;
    static get ecr(): string;
    private constructor();
}
